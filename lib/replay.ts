import { prisma } from "./db";
import { audit } from "./audit";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type ReplayResult = {
  attemptId: string;
  runId: string;
  status: "success" | "failed";
  responseStatus?: number;
  responseBody?: string;
  durationMs: number;
  errorMessage?: string;
  attempts: number;
  deadLettered: boolean;
};

const MAX_ATTEMPTS_HARD_CAP = 5;
const BACKOFF_HARD_CAP_MS = 10_000;
const TIMEOUT_HARD_CAP_MS = 30_000;
const TIMEOUT_HARD_FLOOR_MS = 1_000;

function computeBackoff(
  strategy: "none" | "fixed" | "exponential",
  base: number,
  attemptNumber: number
): number {
  if (strategy === "none") return 0;
  const baseMs = Math.min(Math.max(base, 100), BACKOFF_HARD_CAP_MS);
  if (strategy === "fixed") return baseMs;
  // exponential: base * 2^(n-1), capped
  const raw = baseMs * Math.pow(2, Math.max(0, attemptNumber - 1));
  return Math.min(raw, BACKOFF_HARD_CAP_MS);
}

function shouldRetry(opts: {
  responseStatus?: number;
  errorMessage?: string;
  retryOnStatuses: number[];
}): boolean {
  // Network/timeout errors are always retryable when retry is enabled.
  if (opts.errorMessage && opts.responseStatus === undefined) return true;
  if (opts.responseStatus === undefined) return false;
  return opts.retryOnStatuses.includes(opts.responseStatus);
}

/**
 * Replay a stored webhook event to a configured target URL.
 *
 * Honors target retry policy:
 * - if isRetryEnabled, retries up to maxAttempts (capped at 5)
 * - applies fixed/exponential backoff between attempts
 * - retries on configured statuses or network/timeout errors
 *
 * Always:
 * - records every attempt as a ReplayAttempt row, grouped by runId
 * - never mutates the original event payload
 * - audits start, each result, and dead-letter on final failure
 */
export async function replayEvent(opts: {
  eventId: string;
  targetId?: string;
  actor?: string;
  headerOverrides?: Record<string, string>;
  isAutomatic?: boolean;
}): Promise<ReplayResult> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: opts.eventId },
  });
  if (!event) throw new Error(`Event ${opts.eventId} not found`);

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
  if (!target.isActive)
    throw new Error(`Replay target "${target.name}" is inactive`);

  const runId = randomUUID();
  const maxAttempts = Math.max(
    1,
    Math.min(target.maxAttempts ?? 1, MAX_ATTEMPTS_HARD_CAP)
  );
  const retryEnabled = Boolean(target.isRetryEnabled);
  const timeoutMs = Math.max(
    TIMEOUT_HARD_FLOOR_MS,
    Math.min(target.timeoutMs ?? 15_000, TIMEOUT_HARD_CAP_MS)
  );
  const retryOnStatuses = Array.isArray(target.retryOnStatuses)
    ? (target.retryOnStatuses as number[]).filter(
        (n) => typeof n === "number" && n >= 100 && n < 600
      )
    : [];

  await audit({
    actor: opts.actor,
    action: "event.replay.started",
    entityType: "WebhookEvent",
    entityId: event.id,
    metadata: {
      runId,
      targetId: target.id,
      targetName: target.name,
      targetUrl: target.url,
      retryEnabled,
      maxAttempts,
      automatic: Boolean(opts.isAutomatic),
    },
  });

  const requestPayload = JSON.parse(JSON.stringify(event.payload));
  const storedHeaders = (event.headers as Record<string, string>) || {};
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json",
    "x-replay": "true",
    "x-replay-event-id": event.id,
    "x-replay-original-provider": event.provider,
    "x-replay-original-event-type": event.eventType,
    "x-replay-run-id": runId,
  };
  const drop = new Set([
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
  ]);
  for (const [k, v] of Object.entries(storedHeaders)) {
    if (drop.has(k.toLowerCase())) continue;
    if (typeof v === "string") baseHeaders[k] = v;
  }
  Object.assign(baseHeaders, opts.headerOverrides ?? {});

  let lastAttemptId = "";
  let lastStatus: "success" | "failed" = "failed";
  let lastResponseStatus: number | undefined;
  let lastResponseBody: string | undefined;
  let lastError: string | undefined;
  let lastDuration = 0;
  let attemptsRun = 0;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    attemptsRun = attemptNumber;
    const isRetry = attemptNumber > 1;
    const backoffDelayMs = isRetry
      ? computeBackoff(
          target.backoffStrategy as "none" | "fixed" | "exponential",
          target.backoffBaseMs ?? 500,
          attemptNumber
        )
      : 0;

    if (backoffDelayMs > 0) {
      await audit({
        actor: opts.actor,
        action: "event.replay.retry.scheduled",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: {
          runId,
          attemptNumber,
          backoffDelayMs,
          strategy: target.backoffStrategy,
        },
      });
      await new Promise((r) => setTimeout(r, backoffDelayMs));
    }

    const start = Date.now();
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;
    let attemptStatus: "success" | "failed" = "failed";

    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), timeoutMs);
      const res = await fetch(target.url, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(requestPayload),
        signal: ac.signal,
      }).finally(() => clearTimeout(timeout));

      responseStatus = res.status;
      const text = await res.text();
      responseBody =
        text.length > 8000 ? text.slice(0, 8000) + "…[truncated]" : text;
      attemptStatus = res.ok ? "success" : "failed";
      if (!res.ok) errorMessage = `Non-2xx response: ${res.status}`;
    } catch (err) {
      attemptStatus = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - start;

    const attempt = await prisma.replayAttempt.create({
      data: {
        eventId: event.id,
        targetId: target.id,
        status: attemptStatus,
        requestPayload: requestPayload as Prisma.InputJsonValue,
        responseStatus,
        responseBody,
        durationMs,
        errorMessage,
        runId,
        attemptNumber,
        isAutomatic: Boolean(opts.isAutomatic) || isRetry,
        backoffDelayMs: isRetry ? backoffDelayMs : null,
      },
    });

    lastAttemptId = attempt.id;
    lastStatus = attemptStatus;
    lastResponseStatus = responseStatus;
    lastResponseBody = responseBody;
    lastError = errorMessage;
    lastDuration = durationMs;

    if (isRetry) {
      await audit({
        actor: opts.actor,
        action: "event.replay.retry.attempted",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: {
          runId,
          attemptId: attempt.id,
          attemptNumber,
          status: attemptStatus,
          responseStatus,
          durationMs,
          errorMessage,
        },
      });
    }

    if (attemptStatus === "success") break;

    const willRetry =
      retryEnabled &&
      attemptNumber < maxAttempts &&
      shouldRetry({ responseStatus, errorMessage, retryOnStatuses });
    if (!willRetry) break;
  }

  const finalSuccess = lastStatus === "success";
  const isExhausted = !finalSuccess && retryEnabled && attemptsRun >= maxAttempts;
  const deadLettered = isExhausted;

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: {
      lastReplayAt: new Date(),
      status: finalSuccess
        ? "replayed"
        : deadLettered
        ? "dead_letter"
        : "failed",
      errorMessage: finalSuccess ? null : lastError ?? null,
      targetId: target.id,
      ...(deadLettered
        ? {
            deadLetteredAt: new Date(),
            deadLetterReason: `Replay failed after ${attemptsRun} attempt${
              attemptsRun === 1 ? "" : "s"
            }: ${lastError ?? `status ${lastResponseStatus ?? "unknown"}`}`,
          }
        : {}),
    },
  });

  await audit({
    actor: opts.actor,
    action: finalSuccess ? "event.replay.success" : "event.replay.failed",
    entityType: "WebhookEvent",
    entityId: event.id,
    metadata: {
      runId,
      attemptId: lastAttemptId,
      targetId: target.id,
      targetName: target.name,
      attempts: attemptsRun,
      responseStatus: lastResponseStatus,
      durationMs: lastDuration,
      errorMessage: lastError,
    },
  });

  if (deadLettered) {
    await audit({
      actor: opts.actor,
      action: "event.dead_lettered",
      entityType: "WebhookEvent",
      entityId: event.id,
      metadata: {
        runId,
        attempts: attemptsRun,
        reason: `exhausted retries (max=${maxAttempts})`,
        lastResponseStatus,
        lastError,
      },
    });
  }

  return {
    attemptId: lastAttemptId,
    runId,
    status: lastStatus,
    responseStatus: lastResponseStatus,
    responseBody: lastResponseBody,
    durationMs: lastDuration,
    errorMessage: lastError,
    attempts: attemptsRun,
    deadLettered,
  };
}
