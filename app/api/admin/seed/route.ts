import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { demoTargets, demoEvents, demoEvalCases } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-shot seed endpoint. Wipes and reloads demo data.
 * Protected by ?token=<MIGRATION_TOKEN>.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.MIGRATION_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const log: string[] = [];

  try {
    log.push("[seed] wiping existing rows");
    await prisma.evalRun.deleteMany();
    await prisma.evalTestCase.deleteMany();
    await prisma.replayAttempt.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.replayTarget.deleteMany();

    log.push(`[seed] inserting ${demoTargets.length} replay targets`);
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

    log.push(`[seed] inserting ${demoEvents.length} webhook events`);
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

    log.push("[seed] inserting historical replay attempts");
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

    log.push(`[seed] inserting ${demoEvalCases.length} eval test cases`);
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
        notes: "Bridge accepted with 200; flagged as pass per relaxed rule.",
      },
    });

    log.push("[seed] inserting audit log");
    await prisma.auditLog.createMany({
      data: [
        {
          actor: "seed",
          action: "target.created",
          entityType: "ReplayTarget",
          entityId: "tgt_demo_stripe",
          metadata: { provider: "stripe-demo", name: "Stripe Internal Forwarder" },
        },
        {
          actor: "seed",
          action: "target.created",
          entityType: "ReplayTarget",
          entityId: "tgt_demo_github",
          metadata: { provider: "github-demo", name: "GitHub Sync Worker" },
        },
        {
          actor: "seed",
          action: "target.created",
          entityType: "ReplayTarget",
          entityId: "tgt_demo_shopify",
          metadata: { provider: "shopify-demo", name: "Shopify Order Bridge" },
        },
        {
          actor: "seed",
          action: "event.received",
          entityType: "WebhookEvent",
          entityId: "evt_demo_001",
          metadata: { provider: "stripe-demo", eventType: "payment.failed" },
        },
        {
          actor: "seed",
          action: "event.received",
          entityType: "WebhookEvent",
          entityId: "evt_demo_003",
          metadata: { provider: "github-demo", eventType: "pull_request.opened" },
        },
        {
          actor: "seed",
          action: "event.replay.failed",
          entityType: "WebhookEvent",
          entityId: "evt_demo_001",
          metadata: { attemptId: attempt1.id, responseStatus: 502, durationMs: 1284 },
        },
        {
          actor: "seed",
          action: "event.replay.success",
          entityType: "WebhookEvent",
          entityId: "evt_demo_003",
          metadata: { attemptId: attempt2.id, responseStatus: 200, durationMs: 318 },
        },
        {
          actor: "seed",
          action: "eval.run",
          entityType: "EvalTestCase",
          entityId: "eval_demo_1",
          metadata: { result: "fail", expected: 200, actual: 502 },
        },
        {
          actor: "seed",
          action: "eval.run",
          entityType: "EvalTestCase",
          entityId: "eval_demo_2",
          metadata: { result: "pass", expected: 202, actual: 200 },
        },
      ],
    });

    log.push("[seed] complete");
    return NextResponse.json({
      ok: true,
      counts: {
        targets: demoTargets.length,
        events: demoEvents.length,
        replayAttempts: 2,
        evalCases: demoEvalCases.length,
        evalRuns: 2,
        auditLogs: 9,
      },
      log,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`[seed] FAIL ${message}`);
    return NextResponse.json({ ok: false, error: message, log }, { status: 500 });
  }
}
