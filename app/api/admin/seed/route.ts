import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { demoTargets, demoEvents, demoEvalCases } from "@/lib/demo-data";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-shot seed endpoint. Wipes and reloads demo data.
 * Protected by ?token=<MIGRATION_TOKEN>.
 *
 * Idempotent in the sense that running it repeatedly produces the same state.
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
          isRetryEnabled: t.isRetryEnabled,
          maxAttempts: t.maxAttempts,
          backoffStrategy: t.backoffStrategy,
          backoffBaseMs: t.backoffBaseMs,
          timeoutMs: t.timeoutMs,
          retryOnStatuses: t.retryOnStatuses as Prisma.InputJsonValue,
          isSignatureVerificationEnabled: t.isSignatureVerificationEnabled,
          signatureHeaderName: t.signatureHeaderName,
          signatureAlgorithm: t.signatureAlgorithm,
          signingSecretEnvVar: t.signingSecretEnvVar,
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
          firstSeenAt: new Date(e.receivedAt),
          lastSeenAt: new Date(e.receivedAt),
          errorMessage: e.errorMessage ?? null,
          targetId: e.targetId ?? null,
          externalEventId: e.externalEventId ?? null,
          dedupeKey: e.dedupeKey ?? null,
          duplicateCount: e.duplicateCount ?? 0,
          signatureStatus: e.signatureStatus ?? "not_configured",
          signatureHeaderName: e.signatureHeaderName ?? null,
          signatureVerifiedAt: e.signatureVerifiedAt
            ? new Date(e.signatureVerifiedAt)
            : null,
          signatureFailureReason: e.signatureFailureReason ?? null,
          deadLetterReason: e.deadLetterReason ?? null,
          deadLetteredAt: e.deadLetteredAt ? new Date(e.deadLetteredAt) : null,
        },
      });
    }

    log.push("[seed] inserting historical replay attempts");
    const runIdGood = randomUUID();
    const runIdBad = randomUUID();
    const runIdDead = randomUUID();
    const baseDeadAt = Date.now() - 1000 * 60 * 60 * 4;

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
        runId: runIdBad,
        attemptNumber: 1,
        isAutomatic: false,
      },
    });

    const attempt2 = await prisma.replayAttempt.create({
      data: {
        eventId: "evt_demo_003",
        targetId: "tgt_demo_github",
        status: "success",
        requestPayload: demoEvents[2].payload as object,
        responseStatus: 200,
        responseBody: '{"ok":true,"provider":"github"}',
        durationMs: 318,
        attemptedAt: new Date(Date.now() - 1000 * 60 * 80),
        runId: runIdGood,
        attemptNumber: 1,
        isAutomatic: false,
      },
    });

    // Three retry attempts that exhaust the policy and dead-letter evt_demo_005.
    await prisma.replayAttempt.create({
      data: {
        eventId: "evt_demo_005",
        targetId: "tgt_demo_stripe",
        status: "failed",
        requestPayload: demoEvents[4].payload as object,
        responseStatus: 503,
        responseBody: '{"error":"service unavailable"}',
        durationMs: 412,
        errorMessage: "Non-2xx response: 503",
        attemptedAt: new Date(baseDeadAt - 1500),
        runId: runIdDead,
        attemptNumber: 1,
        isAutomatic: false,
      },
    });
    await prisma.replayAttempt.create({
      data: {
        eventId: "evt_demo_005",
        targetId: "tgt_demo_stripe",
        status: "failed",
        requestPayload: demoEvents[4].payload as object,
        responseStatus: 503,
        responseBody: '{"error":"service unavailable"}',
        durationMs: 388,
        errorMessage: "Non-2xx response: 503",
        attemptedAt: new Date(baseDeadAt - 800),
        runId: runIdDead,
        attemptNumber: 2,
        isAutomatic: true,
        backoffDelayMs: 500,
      },
    });
    await prisma.replayAttempt.create({
      data: {
        eventId: "evt_demo_005",
        targetId: "tgt_demo_stripe",
        status: "failed",
        requestPayload: demoEvents[4].payload as object,
        responseStatus: 503,
        responseBody: '{"error":"service unavailable"}',
        durationMs: 401,
        errorMessage: "Non-2xx response: 503",
        attemptedAt: new Date(baseDeadAt),
        runId: runIdDead,
        attemptNumber: 3,
        isAutomatic: true,
        backoffDelayMs: 1000,
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
          expectedMaxDurationMs: c.expectedMaxDurationMs,
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
        evidence: {
          assertions: [
            {
              type: "statusEquals",
              expected: 200,
              actual: 502,
              passed: false,
              detail: "expected 200, got 502",
            },
            {
              type: "bodyIncludes",
              expected: '"ok":true',
              actual: '{"error":"upstream timeout"}',
              passed: false,
              detail: 'body does not contain "\\"ok\\":true"',
            },
            {
              type: "responseTimeLessThanMs",
              expected: 2000,
              actual: 1284,
              passed: true,
              detail: "1284ms < 2000ms",
            },
          ],
          responseStatus: 502,
          responseBody: '{"error":"upstream timeout"}',
          durationMs: 1284,
          replayStatus: "failed",
          replayRunId: runIdBad,
          attempts: 1,
        },
        notes: 'expected 200, got 502; body does not contain "\\"ok\\":true"',
      },
    });
    await prisma.evalRun.create({
      data: {
        testCaseId: "eval_demo_2",
        replayAttemptId: attempt2.id,
        status: "pass",
        expectedStatus: 200,
        actualStatus: 200,
        evidence: {
          assertions: [
            {
              type: "statusEquals",
              expected: 200,
              actual: 200,
              passed: true,
              detail: "status=200",
            },
            {
              type: "bodyIncludes",
              expected: '"ok":true',
              actual: '{"ok":true,"provider":"github"}',
              passed: true,
              detail: 'body contains "\\"ok\\":true"',
            },
            {
              type: "responseTimeLessThanMs",
              expected: 1500,
              actual: 318,
              passed: true,
              detail: "318ms < 1500ms",
            },
          ],
          responseStatus: 200,
          responseBody: '{"ok":true,"provider":"github"}',
          durationMs: 318,
          replayStatus: "success",
          replayRunId: runIdGood,
          attempts: 1,
        },
        notes: "3/3 assertions passed.",
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
          metadata: {
            provider: "stripe-demo",
            name: "Stripe Internal Forwarder",
          },
        },
        {
          actor: "seed",
          action: "retry_policy_enabled",
          entityType: "ReplayTarget",
          entityId: "tgt_demo_stripe",
          metadata: {
            maxAttempts: 3,
            backoffStrategy: "exponential",
            backoffBaseMs: 500,
            timeoutMs: 15000,
          },
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
          action: "signature_verified",
          entityType: "WebhookEvent",
          entityId: "evt_demo_001",
          metadata: { header: "x-stripe-signature", algorithm: "hmac-sha256" },
        },
        {
          actor: "seed",
          action: "event.received",
          entityType: "WebhookEvent",
          entityId: "evt_demo_002",
          metadata: { provider: "stripe-demo", eventType: "charge.succeeded" },
        },
        {
          actor: "seed",
          action: "duplicate_event_detected",
          entityType: "WebhookEvent",
          entityId: "evt_demo_002",
          metadata: { duplicateCount: 2, externalEventId: "evt_demo_002" },
        },
        {
          actor: "seed",
          action: "event.received",
          entityType: "WebhookEvent",
          entityId: "evt_demo_003",
          metadata: {
            provider: "github-demo",
            eventType: "pull_request.opened",
          },
        },
        {
          actor: "seed",
          action: "event.received",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: {
            provider: "stripe-demo",
            eventType: "invoice.payment_failed",
          },
        },
        {
          actor: "seed",
          action: "event.replay.started",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: { runId: runIdDead, retryEnabled: true, maxAttempts: 3 },
        },
        {
          actor: "seed",
          action: "event.replay.retry.scheduled",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: { runId: runIdDead, attemptNumber: 2, backoffDelayMs: 500 },
        },
        {
          actor: "seed",
          action: "event.replay.retry.attempted",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: {
            runId: runIdDead,
            attemptNumber: 2,
            status: "failed",
            responseStatus: 503,
          },
        },
        {
          actor: "seed",
          action: "event.replay.retry.scheduled",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: { runId: runIdDead, attemptNumber: 3, backoffDelayMs: 1000 },
        },
        {
          actor: "seed",
          action: "event.replay.retry.attempted",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: {
            runId: runIdDead,
            attemptNumber: 3,
            status: "failed",
            responseStatus: 503,
          },
        },
        {
          actor: "seed",
          action: "event.replay.failed",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: {
            runId: runIdDead,
            attempts: 3,
            responseStatus: 503,
          },
        },
        {
          actor: "seed",
          action: "event.dead_lettered",
          entityType: "WebhookEvent",
          entityId: "evt_demo_005",
          metadata: { runId: runIdDead, attempts: 3, reason: "exhausted retries" },
        },
        {
          actor: "seed",
          action: "event.received",
          entityType: "WebhookEvent",
          entityId: "evt_demo_007",
          metadata: { provider: "stripe-demo", eventType: "charge.refunded" },
        },
        {
          actor: "seed",
          action: "signature_verification_failed",
          entityType: "WebhookEvent",
          entityId: "evt_demo_007",
          metadata: {
            header: "x-stripe-signature",
            reason: "HMAC mismatch",
          },
        },
        {
          actor: "seed",
          action: "event.replay.failed",
          entityType: "WebhookEvent",
          entityId: "evt_demo_001",
          metadata: {
            runId: runIdBad,
            attemptId: attempt1.id,
            responseStatus: 502,
            durationMs: 1284,
          },
        },
        {
          actor: "seed",
          action: "event.replay.success",
          entityType: "WebhookEvent",
          entityId: "evt_demo_003",
          metadata: {
            runId: runIdGood,
            attemptId: attempt2.id,
            responseStatus: 200,
            durationMs: 318,
          },
        },
        {
          actor: "seed",
          action: "eval.run.failed",
          entityType: "EvalTestCase",
          entityId: "eval_demo_1",
          metadata: {
            assertionsTotal: 3,
            assertionsFailed: 2,
            actualStatus: 502,
          },
        },
        {
          actor: "seed",
          action: "eval.run.passed",
          entityType: "EvalTestCase",
          entityId: "eval_demo_2",
          metadata: {
            assertionsTotal: 3,
            assertionsFailed: 0,
            actualStatus: 200,
          },
        },
      ],
    });

    log.push("[seed] complete");
    return NextResponse.json({
      ok: true,
      counts: {
        targets: demoTargets.length,
        events: demoEvents.length,
        replayAttempts: 5,
        evalCases: demoEvalCases.length,
        evalRuns: 2,
      },
      log,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`[seed] FAIL ${message}`);
    return NextResponse.json({ ok: false, error: message, log }, { status: 500 });
  }
}
