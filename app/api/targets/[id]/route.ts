import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { replayTargetUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const target = await prisma.replayTarget.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(target);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }
  const parsed = replayTargetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.replayTarget.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.replayTarget.update({
    where: { id: params.id },
    data: parsed.data,
  });

  const actor = req.headers.get("x-actor") ?? "user";
  let action = "target.updated";
  if (parsed.data.isActive === true && existing.isActive === false) {
    action = "target.enabled";
  } else if (parsed.data.isActive === false && existing.isActive === true) {
    action = "target.disabled";
  }

  await audit({
    actor,
    action,
    entityType: "ReplayTarget",
    entityId: updated.id,
    metadata: { changes: parsed.data, previous: { isActive: existing.isActive } },
  });

  // Retry policy audits
  const retryFields: (keyof typeof parsed.data)[] = [
    "isRetryEnabled",
    "maxAttempts",
    "backoffStrategy",
    "backoffBaseMs",
    "timeoutMs",
    "retryOnStatuses",
  ];
  const retryPolicyChanged = retryFields.some((k) => parsed.data[k] !== undefined);
  if (retryPolicyChanged) {
    await audit({
      actor,
      action: "retry_policy_updated",
      entityType: "ReplayTarget",
      entityId: updated.id,
      metadata: {
        isRetryEnabled: updated.isRetryEnabled,
        maxAttempts: updated.maxAttempts,
        backoffStrategy: updated.backoffStrategy,
        backoffBaseMs: updated.backoffBaseMs,
        timeoutMs: updated.timeoutMs,
        retryOnStatuses: updated.retryOnStatuses,
      },
    });
  }
  if (
    parsed.data.isRetryEnabled === true &&
    existing.isRetryEnabled === false
  ) {
    await audit({
      actor,
      action: "retry_policy_enabled",
      entityType: "ReplayTarget",
      entityId: updated.id,
      metadata: { maxAttempts: updated.maxAttempts },
    });
  }
  if (
    parsed.data.isRetryEnabled === false &&
    existing.isRetryEnabled === true
  ) {
    await audit({
      actor,
      action: "retry_policy_disabled",
      entityType: "ReplayTarget",
      entityId: updated.id,
      metadata: {},
    });
  }
  return NextResponse.json(updated);
}
