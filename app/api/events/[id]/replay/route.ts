import { NextRequest, NextResponse } from "next/server";
import { replayRequestSchema } from "@/lib/validators";
import { replayEvent } from "@/lib/replay";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/replay
 *
 * Replays a stored event to its configured replay target. Body is optional
 * but may include `targetId` and `headerOverrides`. The original event
 * payload is never mutated; a new ReplayAttempt is recorded.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown = {};
  try {
    const text = await req.text();
    body = text.length ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: "invalid_json_body" },
      { status: 400 }
    );
  }

  const parsed = replayRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await replayEvent({
      eventId: params.id,
      targetId: parsed.data.targetId,
      headerOverrides: parsed.data.headerOverrides,
      actor: req.headers.get("x-actor") ?? "user",
    });
    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 502,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "replay_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
