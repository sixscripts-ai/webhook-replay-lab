import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/SectionHeader";
import { EventTable } from "@/components/EventTable";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type SearchParams = {
  provider?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
};

const STATUSES = ["received", "delivered", "failed", "replayed"] as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  const where: Record<string, unknown> = {};
  if (searchParams.provider) where.provider = searchParams.provider;
  if (
    searchParams.status &&
    (STATUSES as readonly string[]).includes(searchParams.status)
  ) {
    where.status = searchParams.status;
  }
  if (searchParams.q) {
    where.OR = [
      { id: { contains: searchParams.q } },
      { eventType: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }
  if (searchParams.from || searchParams.to) {
    const range: Record<string, Date> = {};
    if (searchParams.from) range.gte = new Date(searchParams.from);
    if (searchParams.to) range.lte = new Date(searchParams.to);
    where.receivedAt = range;
  }

  const [events, providersRaw] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
    }),
    prisma.webhookEvent.findMany({
      distinct: ["provider"],
      select: { provider: true },
      orderBy: { provider: "asc" },
    }),
  ]);

  const providers = providersRaw.map((p) => p.provider);

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="events"
        title="Inbox"
        description="All captured webhook events across providers. Filter by provider, status, or date — search by event ID or type."
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-border bg-bg-elevated/40 px-6 py-4"
      >
        <Field label="Search">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="evt_… or charge.succeeded"
            className="w-64 rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg placeholder:text-fg-subtle focus:border-volt focus:outline-none"
          />
        </Field>
        <Field label="Provider">
          <select
            name="provider"
            defaultValue={searchParams.provider ?? ""}
            className="rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg focus:border-volt focus:outline-none"
          >
            <option value="">all</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg focus:border-volt focus:outline-none"
          >
            <option value="">all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className="rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg focus:border-volt focus:outline-none"
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ""}
            className="rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg focus:border-volt focus:outline-none"
          />
        </Field>
        <button
          type="submit"
          className="rounded border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-volt hover:bg-volt/20"
        >
          apply
        </button>
        <Link
          href="/events"
          className="rounded border border-border bg-bg-elevated px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-fg-muted hover:border-volt hover:text-volt"
        >
          reset
        </Link>
      </form>

      <div className="px-6 py-6">
        <div className="mb-3 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
          {events.length} result{events.length === 1 ? "" : "s"}
        </div>
        {events.length ? (
          <EventTable
            rows={events.map((e) => ({
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
            title="No matching events"
            description="Adjust filters or send a webhook to /api/webhooks/<provider>."
          />
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}
