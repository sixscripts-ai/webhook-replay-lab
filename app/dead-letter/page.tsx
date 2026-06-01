import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { DeadLetterTable } from "@/components/DeadLetterTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function DeadLetterPage() {
  noStore();
  const events = await prisma.webhookEvent.findMany({
    where: { status: "dead_letter" },
    orderBy: { deadLetteredAt: "desc" },
    include: { target: true },
    take: 200,
  });

  const ids = events.map((e) => e.id);
  const attemptCounts = ids.length
    ? await prisma.replayAttempt.groupBy({
        by: ["eventId"],
        _count: { _all: true },
        where: { eventId: { in: ids } },
      })
    : [];
  const countMap = new Map<string, number>(
    attemptCounts.map((c) => [c.eventId, c._count._all])
  );

  const rows = events.map((e) => ({
    id: e.id,
    provider: e.provider,
    eventType: e.eventType,
    deadLetterReason: e.deadLetterReason,
    deadLetteredAt: e.deadLetteredAt,
    lastReplayAt: e.lastReplayAt,
    targetName: e.target?.name ?? null,
    attemptsCount: countMap.get(e.id) ?? 0,
    reviewedAt: e.deadLetterReviewedAt,
    reviewedBy: e.deadLetterReviewedBy,
  }));

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="reliability"
        title="Dead Letter Queue"
        description="Events that exhausted their retry policy or failed signature verification. Mark items reviewed once you've handled them — the records are kept for audit."
        actions={
          <Link
            href="/events"
            className="rounded border border-border bg-bg-elevated px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-fg-muted hover:border-volt hover:text-volt"
          >
            ← inbox
          </Link>
        }
      />

      <div className="px-6 py-6">
        <div className="mb-3 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
          {rows.length} dead-letter event{rows.length === 1 ? "" : "s"}
        </div>
        {rows.length ? (
          <DeadLetterTable rows={rows} />
        ) : (
          <EmptyState
            title="No dead-letter events"
            description="When a replay exhausts its retry policy or signature verification fails, the event will appear here."
          />
        )}
      </div>
    </div>
  );
}
