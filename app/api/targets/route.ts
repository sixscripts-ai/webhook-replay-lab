import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { replayTargetCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const targets = await prisma.replayTarget.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }
  const parsed = replayTargetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const target = await prisma.replayTarget.create({ data: parsed.data });
  const actor = req.headers.get("x-actor") ?? "user";
  await audit({
    actor,
    action: "target.created",
    entityType: "ReplayTarget",
    entityId: target.id,
    metadata: { name: target.name, provider: target.provider, url: target.url },
  });
  if (target.isRetryEnabled) {
    await audit({
      actor,
      action: "retry_policy_enabled",
      entityType: "ReplayTarget",
      entityId: target.id,
      metadata: {
        maxAttempts: target.maxAttempts,
        backoffStrategy: target.backoffStrategy,
      },
    });
  }
  return NextResponse.json(target, { status: 201 });
}
