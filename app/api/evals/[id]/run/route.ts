import { NextRequest, NextResponse } from "next/server";
import { runEvalCase } from "@/lib/evals";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await runEvalCase({
      testCaseId: params.id,
      actor: req.headers.get("x-actor") ?? "user",
    });
    return NextResponse.json(result, {
      status: result.status === "pass" ? 200 : 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "eval_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
