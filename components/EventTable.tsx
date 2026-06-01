import Link from "next/link";
import { EventStatusBadge } from "./EventStatusBadge";

type Row = {
  id: string;
  provider: string;
  eventType: string;
  status: "received" | "delivered" | "failed" | "replayed";
  receivedAt: Date | string;
  errorMessage?: string | null;
};

export function EventTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            <th className="w-[30%] px-3 py-2 text-left">Event</th>
            <th className="w-[18%] px-3 py-2 text-left">Provider</th>
            <th className="w-[14%] px-3 py-2 text-left">Status</th>
            <th className="w-[20%] px-3 py-2 text-left">Received</th>
            <th className="w-[18%] px-3 py-2 text-left">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ts =
              typeof r.receivedAt === "string"
                ? new Date(r.receivedAt)
                : r.receivedAt;
            return (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-bg-panel/60"
              >
                <td className="truncate px-3 py-2">
                  <Link
                    href={`/events/${r.id}`}
                    className="font-mono text-xs text-fg hover:text-volt"
                  >
                    <span className="text-fg-subtle">›</span>{" "}
                    <span className="text-fg-muted">{r.eventType}</span>
                    <div className="truncate font-mono text-xxs text-fg-subtle">
                      {r.id}
                    </div>
                  </Link>
                </td>
                <td className="truncate px-3 py-2 font-mono text-xs text-fg-muted">
                  {r.provider}
                </td>
                <td className="px-3 py-2">
                  <EventStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                  <time dateTime={ts.toISOString()} title={ts.toISOString()}>
                    {formatRelative(ts)}
                  </time>
                </td>
                <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                  {r.errorMessage ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toISOString().slice(0, 16).replace("T", " ");
}
