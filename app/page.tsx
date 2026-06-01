import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/StatCard";
import { SectionHeader } from "@/components/SectionHeader";
import { EventTable } from "@/components/EventTable";
import { EmptyState } from "@/components/EmptyState";
import { TryItPanel } from "@/components/TryItPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function DashboardPage() {
  noStore();
  const [
    total,
    received,
    delivered,
    failed,
    replayed,
    deadLetter,
    replayAttempts,
    duplicateAgg,
    signatureFailures,
    evalPass,
    evalFail,
    durationAgg,
    recent,
  ] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({ where: { status: "received" } }),
    prisma.webhookEvent.count({ where: { status: "delivered" } }),
    prisma.webhookEvent.count({ where: { status: "failed" } }),
    prisma.webhookEvent.count({ where: { status: "replayed" } }),
    prisma.webhookEvent.count({ where: { status: "dead_letter" } }),
    prisma.replayAttempt.count(),
    prisma.webhookEvent.aggregate({
      _sum: { duplicateCount: true },
    }),
    prisma.webhookEvent.count({ where: { signatureStatus: "failed" } }),
    prisma.evalRun.count({ where: { status: "pass" } }),
    prisma.evalRun.count({ where: { status: "fail" } }),
    prisma.replayAttempt.aggregate({
      _avg: { durationMs: true },
    }),
    prisma.webhookEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 8,
    }),
  ]);

  const successful = delivered + replayed;
  const denominator = total || 1;
  const failureRate = ((failed / denominator) * 100).toFixed(1);
  const duplicateTotal = duplicateAgg._sum.duplicateCount ?? 0;
  const evalTotal = evalPass + evalFail;
  const evalPassRate = evalTotal
    ? ((evalPass / evalTotal) * 100).toFixed(0)
    : null;
  const avgDuration = durationAgg._avg.durationMs
    ? Math.round(durationAgg._avg.durationMs)
    : null;

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="overview"
        title="Webhook Replay Lab"
        description="Capture incoming webhook events, inspect payloads, replay failed deliveries, and track every retry. Demo data is seeded — send your own event with the snippet below."
        actions={
          <Link
            href="/events"
            className="rounded border border-border bg-bg-elevated px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-fg-muted hover:border-volt hover:text-volt"
          >
            open inbox →
          </Link>
        }
      />

      <div className="bg-grid">
        <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total Events" value={total} />
          <StatCard label="Successful" value={successful} tone="ok" />
          <StatCard label="Failed" value={failed} tone="danger" />
          <StatCard label="Replay Attempts" value={replayAttempts} tone="volt" />
          <StatCard
            label="Failure Rate"
            value={`${failureRate}%`}
            tone={failed > 0 ? "warn" : "default"}
            hint={`${received} pending · ${replayed} replayed`}
          />
          <StatCard
            label="Dead Letter"
            value={deadLetter}
            tone={deadLetter > 0 ? "danger" : "default"}
            hint="needs review"
          />
          <StatCard
            label="Duplicates"
            value={duplicateTotal}
            tone={duplicateTotal > 0 ? "warn" : "default"}
            hint="dedupe drops"
          />
          <StatCard
            label="Sig Failures"
            value={signatureFailures}
            tone={signatureFailures > 0 ? "danger" : "default"}
            hint="hmac rejected"
          />
          <StatCard
            label="Eval Pass Rate"
            value={evalPassRate != null ? `${evalPassRate}%` : "—"}
            tone={
              evalPassRate == null
                ? "default"
                : Number(evalPassRate) === 100
                ? "ok"
                : Number(evalPassRate) >= 50
                ? "warn"
                : "danger"
            }
            hint={`${evalPass}/${evalTotal} runs`}
          />
          <StatCard
            label="Avg Replay"
            value={avgDuration != null ? `${avgDuration}ms` : "—"}
            tone="default"
            hint="across attempts"
          />
        </div>

        <div className="grid gap-6 px-6 pb-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-widest text-fg-muted">
                recent events
              </h2>
              <Link
                href="/events"
                className="font-mono text-xxs uppercase tracking-widest text-fg-subtle hover:text-volt"
              >
                view all →
              </Link>
            </div>
            {recent.length ? (
              <EventTable
                rows={recent.map((e) => ({
                  id: e.id,
                  provider: e.provider,
                  eventType: e.eventType,
                  status: e.status,
                  receivedAt: e.receivedAt,
                  errorMessage: e.errorMessage,
                  duplicateCount: e.duplicateCount,
                  signatureStatus: e.signatureStatus,
                }))}
              />
            ) : (
              <EmptyState
                title="No events captured yet"
                description="Send a webhook with the snippet on the right, or POST to /api/webhooks/<provider>."
              />
            )}
          </div>
          <div className="lg:col-span-1">
            <TryItPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
