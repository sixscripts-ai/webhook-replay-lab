import { unstable_noStore as noStore } from "next/cache";
import { SectionHeader } from "@/components/SectionHeader";
import {
  EvalsManager,
  type EvalRow,
  type AssertionEvidence,
} from "@/components/EvalsManager";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function extractAssertions(evidence: unknown): AssertionEvidence[] {
  if (
    evidence &&
    typeof evidence === "object" &&
    !Array.isArray(evidence) &&
    Array.isArray((evidence as { assertions?: unknown }).assertions)
  ) {
    const arr = (evidence as { assertions: unknown[] }).assertions;
    return arr
      .filter((a): a is AssertionEvidence => {
        if (!a || typeof a !== "object") return false;
        const o = a as Record<string, unknown>;
        return (
          (o.type === "statusEquals" ||
            o.type === "bodyIncludes" ||
            o.type === "responseTimeLessThanMs") &&
          typeof o.passed === "boolean"
        );
      })
      .map((a) => ({
        type: a.type,
        expected: a.expected,
        actual: a.actual,
        passed: a.passed,
        detail: a.detail,
      }));
  }
  return [];
}

export default async function EvalsPage() {
  noStore();
  const cases = await prisma.evalTestCase.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, eventType: true, provider: true } },
      target: { select: { id: true, name: true, provider: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  const rows: EvalRow[] = cases.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    targetName: c.target?.name ?? null,
    provider: c.target?.provider ?? c.event?.provider ?? null,
    expectedStatus: c.expectedStatus,
    expectedBodyIncludes: c.expectedBodyIncludes,
    expectedMaxDurationMs: c.expectedMaxDurationMs,
    isActive: c.isActive,
    hasEvent: Boolean(c.eventId),
    latest: c.runs[0]
      ? {
          status: c.runs[0].status,
          actualStatus: c.runs[0].actualStatus,
          notes: c.runs[0].notes,
          createdAt: c.runs[0].createdAt,
          assertions: extractAssertions(c.runs[0].evidence),
        }
      : null,
    history: c.runs.map((r) => ({
      id: r.id,
      status: r.status,
      actualStatus: r.actualStatus,
      notes: r.notes,
      createdAt: r.createdAt,
      assertions: extractAssertions(r.evidence),
    })),
  }));

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="evalbench lite"
        title="Replay Evaluations"
        description="Run real replays against pinned targets and assert on response status, body, and timing. Each assertion is recorded as evidence."
      />
      <div className="px-6 py-6">
        <EvalsManager initial={rows} />
      </div>
    </div>
  );
}
