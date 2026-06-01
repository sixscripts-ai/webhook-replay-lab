import { unstable_noStore as noStore } from "next/cache";
import { SectionHeader } from "@/components/SectionHeader";
import { EvalsManager, type EvalRow } from "@/components/EvalsManager";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
    isActive: c.isActive,
    hasEvent: Boolean(c.eventId),
    latest: c.runs[0]
      ? {
          status: c.runs[0].status,
          actualStatus: c.runs[0].actualStatus,
          notes: c.runs[0].notes,
          createdAt: c.runs[0].createdAt,
        }
      : null,
    history: c.runs.map((r) => ({
      id: r.id,
      status: r.status,
      actualStatus: r.actualStatus,
      notes: r.notes,
      createdAt: r.createdAt,
    })),
  }));

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="evalbench lite"
        title="Replay Evaluations"
        description="Pin an event + target with an expected response status. Click run to perform a real replay and record the result."
      />
      <div className="px-6 py-6">
        <EvalsManager initial={rows} />
      </div>
    </div>
  );
}
