import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Safe internal receiver. Used as the default URL for seeded replay targets so
 * replays work end-to-end without external services.
 *
 * Behavior switches based on payload fields:
 *   forceFailure: true   -> 500
 *   forceStatus: <num>   -> that status
 *   delayMs:     <num>   -> sleep before responding (capped at 10s)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const start = Date.now();
  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  const obj = (body ?? {}) as Record<string, unknown>;
  const delay = typeof obj.delayMs === "number" ? Math.min(Math.max(obj.delayMs, 0), 10_000) : 0;
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  if (obj.forceFailure === true) {
    return NextResponse.json(
      {
        ok: false,
        error: "forced failure",
        provider: params.provider,
      },
      { status: 500 }
    );
  }

  if (typeof obj.forceStatus === "number" && obj.forceStatus >= 100 && obj.forceStatus < 600) {
    return NextResponse.json(
      {
        ok: obj.forceStatus < 400,
        provider: params.provider,
        forced: true,
      },
      { status: obj.forceStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: params.provider,
    receivedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    echoKeys: Object.keys(obj).slice(0, 16),
  });
}
