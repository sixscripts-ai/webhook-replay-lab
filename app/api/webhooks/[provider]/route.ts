import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/[provider]
 *
 * Stores any incoming webhook event verbatim. The body is parsed as JSON if
 * possible — otherwise the raw text is stored under `{ raw: "<text>" }`.
 *
 * Headers are stored as a flat string→string map. Unknown providers are
 * accepted and labeled. The event type is read from common header conventions
 * (x-event-type, x-github-event, x-shopify-topic) or from a `type` field in
 * the body — falling back to "unknown".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = (params.provider || "unknown").slice(0, 120);

  // Capture headers as plain object
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Capture raw body — try JSON first, fall back to text
  const text = await req.text();
  let payload: unknown;
  try {
    payload = text.length ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  // Resolve event type
  const eventType =
    headers["x-event-type"] ??
    headers["x-github-event"] ??
    headers["x-shopify-topic"] ??
    (typeof payload === "object" && payload && "type" in payload
      ? String((payload as Record<string, unknown>).type)
      : null) ??
    "unknown";

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        provider,
        eventType: String(eventType).slice(0, 200),
        status: "received",
        headers: headers as object,
        payload: (payload ?? {}) as object,
      },
    });

    await audit({
      action: "event.received",
      entityType: "WebhookEvent",
      entityId: event.id,
      metadata: { provider, eventType: event.eventType, bytes: text.length },
    });

    return NextResponse.json(
      { ok: true, id: event.id, eventType: event.eventType, provider },
      { status: 202 }
    );
  } catch (err) {
    console.error("[webhook ingest] failed", err);
    return NextResponse.json(
      { ok: false, error: "ingest_failed" },
      { status: 500 }
    );
  }
}
