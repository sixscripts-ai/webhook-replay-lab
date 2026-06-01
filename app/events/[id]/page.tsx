import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/SectionHeader";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { JsonViewer } from "@/components/JsonViewer";
import { ReplayPanel } from "@/components/ReplayPanel";
import { ReplayHistory } from "@/components/ReplayHistory";
import { EventTimeline, type TimelineItem } from "@/components/EventTimeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AuditAction =
  | "event.received"
  | "signature_verified"
  | "signature_verification_failed"
  | "duplicate_event_detected"
  | "event.replay.started"
  | "event.replay.retry.scheduled"
  | "event.replay.retry.attempted"
  | "event.replay.success"
  | "event.replay.failed"
  | "event.dead_lettered"
  | "dead_letter_reviewed"
  | "eval.run.started"
  | "eval.run.passed"
  | "eval.run.failed";

const AUDIT_KIND_MAP: Record<string, TimelineItem["kind"]> = {
  "event.received": "received",
  signature_verified: "signature_verified",
  signature_verification_failed: "signature_failed",
  duplicate_event_detected: "duplicate_detected",
  "event.replay.started": "replay_started",
  "event.replay.retry.scheduled": "retry_scheduled",
  "event.replay.retry.attempted": "replay_attempt",
  "event.replay.success": "replay_success",
  "event.replay.failed": "replay_failed",
  "event.dead_lettered": "dead_lettered",
  dead_letter_reviewed: "dead_letter_reviewed",
  "eval.run.started": "eval_started",
  "eval.run.passed": "eval_passed",
  "eval.run.failed": "eval_failed",
};

function formatMeta(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const entries = Object.entries(metadata as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, 5);
  if (!entries.length) return null;
  return entries
    .map(([k, v]) => {
      const str =
        typeof v === "string"
          ? v
          : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : JSON.stringify(v);
      return `${k}=${str.length > 60 ? `${str.slice(0, 60)}…` : str}`;
    })
    .join(" · ");
}

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
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
      take: 100,
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

  // Build a unified timeline from audit logs + replay attempts.
  const timeline: TimelineItem[] = [];

  timeline.push({
    at: event.receivedAt,
    kind: "received",
    title: `${event.provider} · ${event.eventType}`,
    description: `event captured (${event.id})`,
  });

  for (const log of auditLogs) {
    const kind = AUDIT_KIND_MAP[log.action];
    if (!kind) continue;
    // Skip "received" we already added above.
    if (kind === "received") continue;
    timeline.push({
      at: log.createdAt,
      kind,
      title: log.action,
      description: log.actor ? `by ${log.actor}` : null,
      metadata: formatMeta(log.metadata),
    });
  }

  for (const a of event.replayAttempts) {
    if (a.attemptNumber > 1) {
      timeline.push({
        at: a.attemptedAt,
        kind: "replay_attempt",
        title: `attempt #${a.attemptNumber}${a.isAutomatic ? " (auto)" : ""}`,
        description: a.target?.name ?? null,
        metadata: [
          a.responseStatus ? `status=${a.responseStatus}` : null,
          a.durationMs != null ? `duration=${a.durationMs}ms` : null,
          a.backoffDelayMs != null ? `backoff=${a.backoffDelayMs}ms` : null,
          a.errorMessage ? `error=${a.errorMessage}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      });
    }
  }

  timeline.sort((x, y) => {
    const xt = (typeof x.at === "string" ? new Date(x.at) : x.at).getTime();
    const yt = (typeof y.at === "string" ? new Date(y.at) : y.at).getTime();
    return xt - yt;
  });

  const sigStatus = event.signatureStatus;
  const dupCount = event.duplicateCount ?? 0;

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

      <div className="grid gap-6 px-6 py-6 xl:grid-cols-3">
        <aside className="space-y-3 xl:col-span-1">
          <Meta label="Status">
            <EventStatusBadge status={event.status} />
          </Meta>
          <Meta label="Provider">
            <span className="font-mono text-xs">{event.provider}</span>
          </Meta>
          <Meta label="Event Type">
            <span className="font-mono text-xs">{event.eventType}</span>
          </Meta>
          <Meta label="Signature">
            <SignatureLine
              status={sigStatus}
              header={event.signatureHeaderName}
              verifiedAt={event.signatureVerifiedAt}
              reason={event.signatureFailureReason}
            />
          </Meta>
          <Meta label="Dedupe">
            <span className="font-mono text-xxs text-fg-muted">
              {event.dedupeKey
                ? event.dedupeKey.length > 48
                  ? `${event.dedupeKey.slice(0, 48)}…`
                  : event.dedupeKey
                : "—"}
            </span>
            <div className="mt-0.5 font-mono text-xxs text-fg-subtle">
              duplicates: {dupCount}
              {event.externalEventId
                ? ` · external=${event.externalEventId}`
                : ""}
            </div>
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
          {event.deadLetteredAt ? (
            <Meta label="Dead-letter">
              <span className="font-mono text-xs text-danger">
                {event.deadLetterReason ?? "exhausted retries"}
              </span>
              <div className="mt-0.5 font-mono text-xxs text-fg-subtle">
                at{" "}
                {event.deadLetteredAt
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 19)}
                {event.deadLetterReviewedAt
                  ? ` · reviewed by ${event.deadLetterReviewedBy ?? "—"}`
                  : " · pending review"}
              </div>
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

        <div className="space-y-6 xl:col-span-2">
          <section>
            <h2 className="mb-2 font-mono text-xxs uppercase tracking-widest text-fg-muted">
              timeline
            </h2>
            <EventTimeline items={timeline} />
          </section>

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
                attemptNumber: a.attemptNumber,
                isAutomatic: a.isAutomatic,
                backoffDelayMs: a.backoffDelayMs,
                runId: a.runId,
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] table-fixed border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                        <th className="w-[24%] px-3 py-2.5 text-left">When</th>
                        <th className="w-[20%] px-3 py-2.5 text-left">Actor</th>
                        <th className="w-[28%] px-3 py-2.5 text-left">Action</th>
                        <th className="w-[28%] px-3 py-2.5 text-left">Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 25).map((l) => {
                        const meta = JSON.stringify(l.metadata);
                        return (
                          <tr key={l.id} className="border-b border-border last:border-0 transition-colors hover:bg-bg-panel/40">
                            <td className="px-3 py-2.5 font-mono text-xxs text-fg-muted">
                              {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xxs text-fg-muted">
                              {l.actor}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xxs text-fg">
                              {l.action}
                            </td>
                            <td
                              className="truncate px-3 py-2.5 font-mono text-xxs text-fg-subtle"
                              title={meta}
                            >
                              {meta}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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

function SignatureLine({
  status,
  header,
  verifiedAt,
  reason,
}: {
  status: "not_configured" | "verified" | "failed";
  header: string | null;
  verifiedAt: Date | null;
  reason: string | null;
}) {
  const tone =
    status === "verified"
      ? "border-ok/40 bg-ok/10 text-ok"
      : status === "failed"
      ? "border-danger/50 bg-danger/10 text-danger"
      : "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted";
  const label =
    status === "verified" ? "verified" : status === "failed" ? "failed" : "not configured";
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${tone}`}
      >
        {label}
      </span>
      {header ? (
        <div className="font-mono text-xxs text-fg-subtle">header: {header}</div>
      ) : null}
      {verifiedAt ? (
        <div className="font-mono text-xxs text-fg-subtle">
          at {verifiedAt.toISOString().replace("T", " ").slice(0, 19)}
        </div>
      ) : null}
      {reason ? (
        <div className="font-mono text-xxs text-danger">{reason}</div>
      ) : null}
    </div>
  );
}

// Avoid unused-warning for type-only export above
export type { AuditAction };
