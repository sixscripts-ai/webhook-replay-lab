import { PrismaClient } from "@prisma/client";
import { demoTargets, demoEvents, demoEvalCases } from "../lib/demo-data";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Seeding Webhook Replay Lab demo data");

  // Wipe in dependency order
  await prisma.evalRun.deleteMany();
  await prisma.evalTestCase.deleteMany();
  await prisma.replayAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.replayTarget.deleteMany();

  // Targets
  for (const t of demoTargets) {
    await prisma.replayTarget.create({
      data: {
        id: t.id,
        name: t.name,
        provider: t.provider,
        url: t.url,
        isActive: t.isActive,
      },
    });
  }
  console.log(`  • inserted ${demoTargets.length} replay targets`);

  // Events
  for (const e of demoEvents) {
    await prisma.webhookEvent.create({
      data: {
        id: e.id,
        provider: e.provider,
        eventType: e.eventType,
        status: e.status,
        headers: e.headers as object,
        payload: e.payload as object,
        receivedAt: new Date(e.receivedAt),
        errorMessage: e.errorMessage ?? null,
        targetId: e.targetId ?? null,
      },
    });
  }
  console.log(`  • inserted ${demoEvents.length} webhook events`);

  // A couple of historical replay attempts, so detail pages have data
  const attempt1 = await prisma.replayAttempt.create({
    data: {
      eventId: "evt_demo_001",
      targetId: "tgt_demo_stripe",
      status: "failed",
      requestPayload: demoEvents[0].payload as object,
      responseStatus: 502,
      responseBody: '{"error":"upstream timeout"}',
      durationMs: 1284,
      errorMessage: "Non-2xx response: 502",
      attemptedAt: new Date(Date.now() - 1000 * 60 * 10),
    },
  });

  const attempt2 = await prisma.replayAttempt.create({
    data: {
      eventId: "evt_demo_003",
      targetId: "tgt_demo_github",
      status: "success",
      requestPayload: demoEvents[2].payload as object,
      responseStatus: 200,
      responseBody: '{"ok":true}',
      durationMs: 318,
      attemptedAt: new Date(Date.now() - 1000 * 60 * 80),
    },
  });

  // Eval cases
  for (const c of demoEvalCases) {
    await prisma.evalTestCase.create({
      data: {
        id: c.id,
        name: c.name,
        description: c.description,
        eventId: c.eventId,
        targetId: c.targetId,
        expectedStatus: c.expectedStatus,
        expectedBodyIncludes: c.expectedBodyIncludes,
        isActive: c.isActive,
      },
    });
  }

  await prisma.evalRun.create({
    data: {
      testCaseId: "eval_demo_1",
      replayAttemptId: attempt1.id,
      status: "fail",
      expectedStatus: 200,
      actualStatus: 502,
      evidence: { responseBody: '{"error":"upstream timeout"}' },
      notes: "Forwarder returned 502.",
    },
  });
  await prisma.evalRun.create({
    data: {
      testCaseId: "eval_demo_2",
      replayAttemptId: attempt2.id,
      status: "pass",
      expectedStatus: 202,
      actualStatus: 200,
      evidence: { responseBody: '{"ok":true}' },
      notes: "Bridge accepted with 200, expected 202; flagged as fail-by-status but kept passing per legacy.",
    },
  });

  // Seed audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        actor: "seed",
        action: "target.created",
        entityType: "ReplayTarget",
        entityId: "tgt_demo_stripe",
        metadata: { provider: "stripe-demo" },
      },
      {
        actor: "seed",
        action: "event.replay.failed",
        entityType: "WebhookEvent",
        entityId: "evt_demo_001",
        metadata: { attemptId: attempt1.id, responseStatus: 502 },
      },
      {
        actor: "seed",
        action: "event.replay.success",
        entityType: "WebhookEvent",
        entityId: "evt_demo_003",
        metadata: { attemptId: attempt2.id, responseStatus: 200 },
      },
    ],
  });

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
