import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EvalsPage() {
  const cases = await prisma.evalTestCase.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, eventType: true, provider: true } },
      target: { select: { id: true, name: true, provider: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="evalbench lite"
        title="Replay Evaluations"
        description="Read-only view of replay test cases. Each case pins an event + target with an expected response status. Pass/fail is recorded from the latest run."
      />
      <div className="px-6 py-6">
        {cases.length ? (
          <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                  <th className="w-[22%] px-3 py-2 text-left">Test Case</th>
                  <th className="w-[20%] px-3 py-2 text-left">Target / Provider</th>
                  <th className="w-[10%] px-3 py-2 text-left">Expected</th>
                  <th className="w-[10%] px-3 py-2 text-left">Actual</th>
                  <th className="w-[10%] px-3 py-2 text-left">Result</th>
                  <th className="w-[28%] px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const run = c.runs[0];
                  const result = run?.status ?? (c.isActive ? "ready" : "inactive");
                  const tone =
                    result === "pass"
                      ? "border-ok/40 bg-ok/10 text-ok"
                      : result === "fail"
                      ? "border-danger/50 bg-danger/10 text-danger"
                      : result === "ready"
                      ? "border-volt/50 bg-volt/10 text-volt"
                      : "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted";
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs text-fg">{c.name}</div>
                        {c.description ? (
                          <div className="mt-1 font-mono text-xxs text-fg-subtle">
                            {c.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                        {c.target ? c.target.name : "—"}
                        <div className="text-fg-subtle">
                          {c.target?.provider ?? c.event?.provider ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-fg">
                        {c.expectedStatus}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                        {run?.actualStatus ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${tone}`}
                        >
                          {result}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xxs text-fg-subtle">
                        {run?.notes ?? "no run recorded"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-border px-3 py-2 font-mono text-xxs text-fg-subtle">
              Read-only · runner UI is planned. Expected/actual/result are sourced from the latest seeded EvalRun.
            </div>
          </div>
        ) : (
          <EmptyState
            title="No eval test cases yet"
            description="Seed demo data to populate replay evaluations."
          />
        )}
      </div>
    </div>
  );
}
