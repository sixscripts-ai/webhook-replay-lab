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
  const [total, received, delivered, failed, replayed, replayAttempts, recent] =
    await Promise.all([
      prisma.webhookEvent.count(),
      prisma.webhookEvent.count({ where: { status: "received" } }),
      prisma.webhookEvent.count({ where: { status: "delivered" } }),
      prisma.webhookEvent.count({ where: { status: "failed" } }),
      prisma.webhookEvent.count({ where: { status: "replayed" } }),
      prisma.replayAttempt.count(),
      prisma.webhookEvent.findMany({
        orderBy: { receivedAt: "desc" },
        take: 8,
      }),
    ]);

  const successful = delivered + replayed;
  const denominator = total || 1;
  const failureRate = ((failed / denominator) * 100).toFixed(1);

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
