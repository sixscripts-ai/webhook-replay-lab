import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/SectionHeader";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { JsonViewer } from "@/components/JsonViewer";
import { ReplayPanel } from "@/components/ReplayPanel";
import { ReplayHistory } from "@/components/ReplayHistory";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: params.id },
    include: {
      target: true,
      replayAttempts: {
        orderBy: { attemptedAt: "desc" },
        include: { target: true },
      },
    },
  });

  if (!event) notFound();

  const [auditLogs, allTargets] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "WebhookEvent", entityId: event.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.replayTarget.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const canReplay = event.status !== "delivered";
  const disabledReason =
    event.status === "delivered"
      ? "This event was already delivered to its destination."
      : undefined;

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow={`event · ${event.provider}`}
        title={event.eventType}
        description={event.id}
        actions={
          <Link
            href="/events"
            className="rounded border border-border bg-bg-elevated px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-fg-muted hover:border-volt hover:text-volt"
          >
            ← inbox
          </Link>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <aside className="space-y-3 lg:col-span-1">
          <Meta label="Status">
            <EventStatusBadge status={event.status} />
          </Meta>
          <Meta label="Provider">
            <span className="font-mono text-xs">{event.provider}</span>
          </Meta>
          <Meta label="Event Type">
            <span className="font-mono text-xs">{event.eventType}</span>
          </Meta>
          <Meta label="Received">
            <span className="font-mono text-xs">
              {event.receivedAt.toISOString().replace("T", " ").slice(0, 19)}
            </span>
          </Meta>
          <Meta label="Last Replay">
            <span className="font-mono text-xs">
              {event.lastReplayAt
                ? event.lastReplayAt
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 19)
                : "—"}
            </span>
          </Meta>
          <Meta label="Target">
            <span className="font-mono text-xs">
              {event.target ? event.target.name : "—"}
            </span>
            {event.target ? (
              <span className="block truncate font-mono text-xxs text-fg-subtle">
                {event.target.url}
              </span>
            ) : null}
          </Meta>
          {event.errorMessage ? (
            <Meta label="Error">
              <span className="font-mono text-xs text-danger">
                {event.errorMessage}
              </span>
            </Meta>
          ) : null}
          <ReplayPanel
            eventId={event.id}
            eventProvider={event.provider}
            defaultTargetId={event.targetId}
            canReplay={canReplay}
            disabledReason={disabledReason}
            targets={allTargets.map((t) => ({
              id: t.id,
              name: t.name,
              provider: t.provider,
              url: t.url,
              isActive: t.isActive,
            }))}
          />
        </aside>

        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
              payload
            </h2>
            <JsonViewer value={event.payload} />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
              headers
            </h2>
            <JsonViewer value={event.headers} compact />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
              replay history
            </h2>
            <ReplayHistory
              attempts={event.replayAttempts.map((a) => ({
                id: a.id,
                status: a.status,
                responseStatus: a.responseStatus,
                responseBody: a.responseBody,
                durationMs: a.durationMs,
                errorMessage: a.errorMessage,
                attemptedAt: a.attemptedAt,
                target: a.target ? { name: a.target.name, url: a.target.url } : null,
              }))}
            />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
              related audit log
            </h2>
            {auditLogs.length ? (
              <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
                <table className="w-full table-fixed border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                      <th className="w-[24%] px-3 py-2 text-left">When</th>
                      <th className="w-[20%] px-3 py-2 text-left">Actor</th>
                      <th className="w-[28%] px-3 py-2 text-left">Action</th>
                      <th className="w-[28%] px-3 py-2 text-left">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                          {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                          {l.actor}
                        </td>
                        <td className="px-3 py-2 font-mono text-xxs text-fg">
                          {l.action}
                        </td>
                        <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                          {JSON.stringify(l.metadata)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 px-4 py-6 text-center font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                no audit entries
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated p-3">
      <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
