import { prisma } from "./db";
import { audit } from "./audit";
import { replayEvent } from "./replay";

export type EvalRunResult = {
  evalRunId: string;
  status: "pass" | "fail";
  expectedStatus: number;
  actualStatus?: number | null;
  notes?: string;
};

/**
 * Execute an eval test case. Performs a real replay against the case's pinned
 * target, records an EvalRun row, and writes audit logs.
 */
export async function runEvalCase(opts: {
  testCaseId: string;
  actor?: string;
}): Promise<EvalRunResult> {
  const testCase = await prisma.evalTestCase.findUnique({
    where: { id: opts.testCaseId },
  });
  if (!testCase) throw new Error(`Eval test case ${opts.testCaseId} not found`);
  if (!testCase.eventId)
    throw new Error("Eval test case has no associated event to replay");

  await audit({
    actor: opts.actor,
    action: "eval.run.started",
    entityType: "EvalTestCase",
    entityId: testCase.id,
    metadata: {
      eventId: testCase.eventId,
      targetId: testCase.targetId,
      expectedStatus: testCase.expectedStatus,
    },
  });

  const replay = await replayEvent({
    eventId: testCase.eventId,
    targetId: testCase.targetId ?? undefined,
    actor: opts.actor ?? "evalbench",
  });

  const statusMatches = replay.responseStatus === testCase.expectedStatus;
  let bodyMatches = true;
  if (testCase.expectedBodyIncludes) {
    bodyMatches = (replay.responseBody ?? "").includes(testCase.expectedBodyIncludes);
  }
  const passed = statusMatches && bodyMatches;
  let notes = "";
  if (!statusMatches) {
    notes = `Expected status ${testCase.expectedStatus}, got ${replay.responseStatus ?? "no response"}.`;
  } else if (!bodyMatches) {
    notes = `Status matched but response body does not include "${testCase.expectedBodyIncludes}".`;
  } else {
    notes = "Status and body matched expectations.";
  }

  const evalRun = await prisma.evalRun.create({
    data: {
      testCaseId: testCase.id,
      replayAttemptId: replay.attemptId,
      status: passed ? "pass" : "fail",
      expectedStatus: testCase.expectedStatus,
      actualStatus: replay.responseStatus,
      evidence: {
        responseStatus: replay.responseStatus,
        responseBody: replay.responseBody?.slice(0, 2000),
        durationMs: replay.durationMs,
        replayStatus: replay.status,
        errorMessage: replay.errorMessage,
        expectedBodyIncludes: testCase.expectedBodyIncludes,
        bodyMatches,
        statusMatches,
      },
      notes,
    },
  });

  await audit({
    actor: opts.actor ?? "evalbench",
    action: passed ? "eval.run.passed" : "eval.run.failed",
    entityType: "EvalTestCase",
    entityId: testCase.id,
    metadata: {
      evalRunId: evalRun.id,
      replayAttemptId: replay.attemptId,
      expectedStatus: testCase.expectedStatus,
      actualStatus: replay.responseStatus,
    },
  });

  return {
    evalRunId: evalRun.id,
    status: passed ? "pass" : "fail",
    expectedStatus: testCase.expectedStatus,
    actualStatus: replay.responseStatus,
    notes,
  };
}
