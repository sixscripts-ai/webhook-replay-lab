import { prisma } from "./db";
import { audit } from "./audit";
import { replayEvent } from "./replay";

export type Assertion =
  | { type: "statusEquals"; expected: number }
  | { type: "bodyIncludes"; expected: string }
  | { type: "responseTimeLessThanMs"; expected: number };

export type AssertionResult = {
  type: Assertion["type"];
  expected: number | string;
  actual: number | string | null;
  passed: boolean;
  detail?: string;
};

export type EvalRunResult = {
  evalRunId: string;
  status: "pass" | "fail";
  expectedStatus: number;
  actualStatus?: number | null;
  assertions: AssertionResult[];
  notes?: string;
};

/**
 * Build the effective assertion list for an eval test case. If an explicit
 * assertions[] is configured it is used as-is. Otherwise, fall back to the
 * legacy fields (expectedStatus, expectedBodyIncludes, expectedMaxDurationMs)
 * so old test cases keep working.
 */
function resolveAssertions(testCase: {
  expectedStatus: number;
  expectedBodyIncludes: string | null;
  expectedMaxDurationMs: number | null;
  assertions: unknown;
}): Assertion[] {
  const explicit = Array.isArray(testCase.assertions)
    ? (testCase.assertions as Assertion[]).filter(
        (a) =>
          a &&
          typeof a === "object" &&
          (a.type === "statusEquals" ||
            a.type === "bodyIncludes" ||
            a.type === "responseTimeLessThanMs")
      )
    : [];
  if (explicit.length) return explicit;

  const legacy: Assertion[] = [
    { type: "statusEquals", expected: testCase.expectedStatus },
  ];
  if (testCase.expectedBodyIncludes) {
    legacy.push({
      type: "bodyIncludes",
      expected: testCase.expectedBodyIncludes,
    });
  }
  if (testCase.expectedMaxDurationMs) {
    legacy.push({
      type: "responseTimeLessThanMs",
      expected: testCase.expectedMaxDurationMs,
    });
  }
  return legacy;
}

function evaluateAssertion(
  a: Assertion,
  reply: {
    responseStatus?: number | null;
    responseBody?: string | null;
    durationMs?: number | null;
  }
): AssertionResult {
  switch (a.type) {
    case "statusEquals": {
      const actual = reply.responseStatus ?? null;
      const passed = actual === a.expected;
      return {
        type: a.type,
        expected: a.expected,
        actual,
        passed,
        detail: passed
          ? `status=${actual}`
          : `expected ${a.expected}, got ${actual ?? "no response"}`,
      };
    }
    case "bodyIncludes": {
      const body = reply.responseBody ?? "";
      const passed = body.includes(a.expected);
      return {
        type: a.type,
        expected: a.expected,
        actual: body.length > 80 ? `${body.slice(0, 80)}…` : body,
        passed,
        detail: passed
          ? `body contains "${a.expected}"`
          : `body does not contain "${a.expected}"`,
      };
    }
    case "responseTimeLessThanMs": {
      const actual = reply.durationMs ?? null;
      const passed = actual !== null && actual < a.expected;
      return {
        type: a.type,
        expected: a.expected,
        actual,
        passed,
        detail: passed
          ? `${actual}ms < ${a.expected}ms`
          : `expected < ${a.expected}ms, got ${actual ?? "no timing"}ms`,
      };
    }
  }
}

/**
 * Execute an eval test case. Performs a real replay against the case's pinned
 * target, evaluates each configured assertion, records an EvalRun row with
 * per-assertion evidence, and writes audit logs.
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

  const assertions = resolveAssertions(testCase);
  const results = assertions.map((a) =>
    evaluateAssertion(a, {
      responseStatus: replay.responseStatus,
      responseBody: replay.responseBody,
      durationMs: replay.durationMs,
    })
  );
  const passed = results.length > 0 && results.every((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const notes = passed
    ? `${results.length}/${results.length} assertion${
        results.length === 1 ? "" : "s"
      } passed.`
    : failed.map((r) => r.detail ?? r.type).join("; ");

  const evalRun = await prisma.evalRun.create({
    data: {
      testCaseId: testCase.id,
      replayAttemptId: replay.attemptId,
      status: passed ? "pass" : "fail",
      expectedStatus: testCase.expectedStatus,
      actualStatus: replay.responseStatus,
      evidence: {
        assertions: results,
        responseStatus: replay.responseStatus,
        responseBody: replay.responseBody?.slice(0, 2000),
        durationMs: replay.durationMs,
        replayStatus: replay.status,
        replayRunId: replay.runId,
        attempts: replay.attempts,
        errorMessage: replay.errorMessage,
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
      assertionsTotal: results.length,
      assertionsFailed: failed.length,
    },
  });

  return {
    evalRunId: evalRun.id,
    status: passed ? "pass" : "fail",
    expectedStatus: testCase.expectedStatus,
    actualStatus: replay.responseStatus,
    assertions: results,
    notes,
  };
}
