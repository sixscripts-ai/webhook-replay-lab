import { prisma } from "./db";
import { audit } from "./audit";
import type { Prisma } from "@prisma/client";

export type ReplayResult = {
  attemptId: string;
  status: "success" | "failed";
  responseStatus?: number;
  responseBody?: string;
  durationMs: number;
  errorMessage?: string;
};

/**
 * Replay a stored webhook event to a configured target URL.
 *
 * Important behaviors:
 * - Never mutates the original event payload.
 * - Always records a ReplayAttempt (success or failure).
 * - Updates the parent event's `status` to `replayed` on success and
 *   `failed` on failure (only if it wasn't already delivered).
 * - Writes an audit log entry.
 */
export async function replayEvent(opts: {
  eventId: string;
  targetId?: string;
  actor?: string;
  headerOverrides?: Record<string, string>;
}): Promise<ReplayResult> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: opts.eventId },
  });
  if (!event) throw new Error(`Event ${opts.eventId} not found`);

  // Resolve target: explicit override -> event's stored target -> first active target for provider
  let targetId = opts.targetId ?? event.targetId ?? null;
  if (!targetId) {
    const fallback = await prisma.replayTarget.findFirst({
      where: { provider: event.provider, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (fallback) targetId = fallback.id;
  }
  if (!targetId) {
    throw new Error(
      `No replay target configured for provider "${event.provider}"`
    );
  }

  const target = await prisma.replayTarget.findUnique({
    where: { id: targetId },
  });
  if (!target) throw new Error(`Replay target ${targetId} not found`);
  if (!target.isActive) throw new Error(`Replay target "${target.name}" is inactive`);

  await audit({
    actor: opts.actor,
    action: "event.replay.started",
    entityType: "WebhookEvent",
    entityId: event.id,
    metadata: { targetId: target.id, targetName: target.name, targetUrl: target.url },
  });

  // Clone the payload so we never mutate the original
  const requestPayload = JSON.parse(JSON.stringify(event.payload));

  // Build headers — start from stored headers, layer overrides
  const storedHeaders = (event.headers as Record<string, string>) || {};
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json",
    "x-replay": "true",
    "x-replay-event-id": event.id,
    "x-replay-original-provider": event.provider,
    "x-replay-original-event-type": event.eventType,
  };
  // Drop hop-by-hop / unsafe headers from stored set
  const drop = new Set(["host", "content-length", "connection", "transfer-encoding"]);
  for (const [k, v] of Object.entries(storedHeaders)) {
    if (drop.has(k.toLowerCase())) continue;
    if (typeof v === "string") baseHeaders[k] = v;
  }
  Object.assign(baseHeaders, opts.headerOverrides ?? {});

  const start = Date.now();
  let status: "success" | "failed" = "failed";
  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let errorMessage: string | undefined;

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15_000);
    const res = await fetch(target.url, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify(requestPayload),
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));

    responseStatus = res.status;
    // cap stored body size
    const text = await res.text();
    responseBody = text.length > 8000 ? text.slice(0, 8000) + "…[truncated]" : text;
    status = res.ok ? "success" : "failed";
    if (!res.ok) errorMessage = `Non-2xx response: ${res.status}`;
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - start;

  const attempt = await prisma.replayAttempt.create({
    data: {
      eventId: event.id,
      targetId: target.id,
      status,
      requestPayload: requestPayload as Prisma.InputJsonValue,
      responseStatus,
      responseBody,
      durationMs,
      errorMessage,
    },
  });

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: {
      lastReplayAt: new Date(),
      status: status === "success" ? "replayed" : "failed",
      errorMessage: status === "failed" ? errorMessage : null,
      targetId: target.id,
    },
  });

  await audit({
    actor: opts.actor,
    action: status === "success" ? "event.replay.success" : "event.replay.failed",
    entityType: "WebhookEvent",
    entityId: event.id,
    metadata: {
      attemptId: attempt.id,
      targetId: target.id,
      targetName: target.name,
      responseStatus,
      durationMs,
      errorMessage,
    },
  });

  return {
    attemptId: attempt.id,
    status,
    responseStatus,
    responseBody,
    durationMs,
    errorMessage,
  };
}
