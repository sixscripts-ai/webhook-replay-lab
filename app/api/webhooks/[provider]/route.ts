import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/[provider]
 *
 * Stores any incoming webhook event verbatim. The body is parsed as JSON if
 * possible — otherwise the raw text is stored under `{ raw: "<text>" }`.
 *
 * Milestone 3 additions:
 *  - Optional HMAC SHA-256 signature verification against any active target
 *    for this provider that has signature verification enabled. The signing
 *    secret is read from a target-configured env var name; never stored in DB.
 *  - Event deduplication via dedupeKey = provider + ":" + (externalEventId
 *    || sha256(canonicalJson(payload) + ":" + eventType)). On duplicate the
 *    existing event's duplicateCount + lastSeenAt are incremented and a
 *    duplicate_event_detected audit row is written.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = (params.provider || "unknown").slice(0, 120);

  // Capture headers as plain object (case-insensitive lookup helper below)
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // Capture raw body — try JSON first, fall back to text
  const rawBody = await req.text();
  let payload: unknown;
  try {
    payload = rawBody.length ? JSON.parse(rawBody) : {};
  } catch {
    payload = { raw: rawBody };
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
  const eventTypeStr = String(eventType).slice(0, 200);

  // Signature verification (best-effort: any active target for this provider
  // that has verification enabled). Failures still store the event so the
  // dead-letter / audit views can show the failure.
  let signatureStatus: "not_configured" | "verified" | "failed" = "not_configured";
  let signatureHeaderName: string | null = null;
  let signatureFailureReason: string | null = null;
  let signatureVerifiedAt: Date | null = null;

  try {
    const verifyTarget = await prisma.replayTarget.findFirst({
      where: {
        provider,
        isActive: true,
        isSignatureVerificationEnabled: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (verifyTarget && verifyTarget.signatureHeaderName) {
      signatureHeaderName = verifyTarget.signatureHeaderName;
      const secretEnvVar = verifyTarget.signingSecretEnvVar ?? "";
      const secret = secretEnvVar ? process.env[secretEnvVar] : undefined;
      const candidate = headers[verifyTarget.signatureHeaderName.toLowerCase()];

      if (!secret) {
        signatureStatus = "failed";
        signatureFailureReason = `missing secret env var (${secretEnvVar || "<unset>"})`;
      } else if (!candidate) {
        signatureStatus = "failed";
        signatureFailureReason = `missing signature header (${verifyTarget.signatureHeaderName})`;
      } else {
        const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
        // strip optional "sha256=" prefix that some providers send
        const provided = candidate.replace(/^sha256=/i, "").trim();
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(provided, "hex");
        if (a.length !== b.length || a.length === 0) {
          signatureStatus = "failed";
          signatureFailureReason = "signature length mismatch";
        } else if (timingSafeEqual(a, b)) {
          signatureStatus = "verified";
          signatureVerifiedAt = new Date();
        } else {
          signatureStatus = "failed";
          signatureFailureReason = "signature mismatch";
        }
      }
    }
  } catch (err) {
    signatureStatus = "failed";
    signatureFailureReason =
      err instanceof Error ? err.message : "signature verification error";
  }

  // Compute dedupeKey
  const externalEventId = extractExternalEventId(headers, payload);
  const dedupeKey = computeDedupeKey({
    provider,
    eventType: eventTypeStr,
    externalEventId,
    payload,
  });

  try {
    // Look up existing event by dedupeKey (unique index)
    const existing = await prisma.webhookEvent.findUnique({
      where: { dedupeKey },
    });

    if (existing) {
      const updated = await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: {
          duplicateCount: { increment: 1 },
          lastSeenAt: new Date(),
        },
      });
      await audit({
        action: "duplicate_event_detected",
        entityType: "WebhookEvent",
        entityId: existing.id,
        metadata: {
          provider,
          eventType: eventTypeStr,
          dedupeKey,
          duplicateCount: updated.duplicateCount,
        },
      });
      return NextResponse.json(
        {
          ok: true,
          id: existing.id,
          duplicate: true,
          duplicateCount: updated.duplicateCount,
        },
        { status: 200 }
      );
    }

    const event = await prisma.webhookEvent.create({
      data: {
        provider,
        eventType: eventTypeStr,
        status: "received",
        headers: headers as object,
        payload: (payload ?? {}) as object,
        externalEventId: externalEventId ?? undefined,
        dedupeKey,
        signatureStatus,
        signatureHeaderName: signatureHeaderName ?? undefined,
        signatureVerifiedAt: signatureVerifiedAt ?? undefined,
        signatureFailureReason: signatureFailureReason ?? undefined,
      },
    });

    await audit({
      action: "event.received",
      entityType: "WebhookEvent",
      entityId: event.id,
      metadata: { provider, eventType: event.eventType, bytes: rawBody.length },
    });

    if (signatureStatus === "verified") {
      await audit({
        action: "signature_verified",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: { provider, headerName: signatureHeaderName },
      });
    } else if (signatureStatus === "failed") {
      await audit({
        action: "signature_verification_failed",
        entityType: "WebhookEvent",
        entityId: event.id,
        metadata: {
          provider,
          headerName: signatureHeaderName,
          reason: signatureFailureReason,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        id: event.id,
        eventType: event.eventType,
        provider,
        signatureStatus,
      },
      { status: signatureStatus === "failed" ? 400 : 202 }
    );
  } catch (err) {
    console.error("[webhook ingest] failed", err);
    return NextResponse.json(
      { ok: false, error: "ingest_failed" },
      { status: 500 }
    );
  }
}

/**
 * Pull a stable external event id from common header conventions or payload
 * fields. Returns null when nothing recognizable is present.
 */
function extractExternalEventId(
  headers: Record<string, string>,
  payload: unknown
): string | null {
  const headerCandidates = [
    headers["x-event-id"],
    headers["x-github-delivery"],
    headers["x-shopify-webhook-id"],
    headers["x-request-id"],
  ];
  for (const h of headerCandidates) {
    if (typeof h === "string" && h.length > 0) return h.slice(0, 200);
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const fromPayload = obj.id ?? obj.event_id ?? obj.eventId;
    if (typeof fromPayload === "string" && fromPayload.length > 0) {
      return fromPayload.slice(0, 200);
    }
    if (typeof fromPayload === "number") {
      return String(fromPayload);
    }
  }
  return null;
}

/**
 * Stable dedupe key. Prefer provider:externalEventId; otherwise hash a
 * canonical JSON projection of (eventType, payload).
 */
function computeDedupeKey(opts: {
  provider: string;
  eventType: string;
  externalEventId: string | null;
  payload: unknown;
}): string {
  if (opts.externalEventId) {
    return `${opts.provider}:${opts.externalEventId}`;
  }
  const canonical = canonicalJson(opts.payload ?? {});
  const hash = createHash("sha256")
    .update(`${opts.eventType}:${canonical}`)
    .digest("hex");
  return `${opts.provider}:hash:${hash}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}
