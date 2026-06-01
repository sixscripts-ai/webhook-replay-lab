import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: params.id },
  });
  if (!event) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }
  if (event.status !== "dead_letter") {
    return NextResponse.json(
      { error: "event is not in dead-letter state" },
      { status: 400 }
    );
  }
  if (event.deadLetterReviewedAt) {
    return NextResponse.json({
      ok: true,
      reviewedAt: event.deadLetterReviewedAt,
      reviewedBy: event.deadLetterReviewedBy,
    });
  }

  const reviewedAt = new Date();
  const reviewedBy = "demo-user";
  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: {
      deadLetterReviewedAt: reviewedAt,
      deadLetterReviewedBy: reviewedBy,
    },
  });

  await audit({
    actor: reviewedBy,
    action: "dead_letter_reviewed",
    entityType: "WebhookEvent",
    entityId: event.id,
    metadata: {
      reviewedAt: reviewedAt.toISOString(),
      reason: event.deadLetterReason,
    },
  });

  return NextResponse.json({ ok: true, reviewedAt, reviewedBy });
}
