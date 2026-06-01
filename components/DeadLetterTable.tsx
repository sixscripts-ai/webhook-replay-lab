"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type DeadLetterRow = {
  id: string;
  provider: string;
  eventType: string;
  deadLetterReason: string | null;
  deadLetteredAt: Date | string | null;
  lastReplayAt: Date | string | null;
  targetName: string | null;
  attemptsCount: number;
  reviewedAt: Date | string | null;
  reviewedBy: string | null;
};

export function DeadLetterTable({ rows }: { rows: DeadLetterRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function review(id: string) {
    setPendingId(id);
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/dead-letter/${id}/review`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error ?? `Review failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [id]: err instanceof Error ? err.message : "Review failed",
      }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            <th className="w-[24%] px-3 py-2 text-left">Event</th>
            <th className="w-[12%] px-3 py-2 text-left">Provider</th>
            <th className="w-[8%] px-3 py-2 text-left">Attempts</th>
            <th className="w-[14%] px-3 py-2 text-left">Last Attempt</th>
            <th className="w-[24%] px-3 py-2 text-left">Reason</th>
            <th className="w-[18%] px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ts = r.deadLetteredAt
              ? typeof r.deadLetteredAt === "string"
                ? new Date(r.deadLetteredAt)
                : r.deadLetteredAt
              : null;
            const reviewed = r.reviewedAt != null;
            return (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 align-top"
              >
                <td className="px-3 py-2">
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
                  {r.targetName ? (
                    <div className="truncate font-mono text-xxs text-fg-subtle">
                      → {r.targetName}
                    </div>
                  ) : null}
                </td>
                <td className="truncate px-3 py-2 font-mono text-xs text-fg-muted">
                  {r.provider}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                  {r.attemptsCount}
                </td>
                <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                  {ts ? ts.toISOString().slice(0, 19).replace("T", " ") : "—"}
                </td>
                <td className="truncate px-3 py-2 font-mono text-xxs text-danger">
                  {r.deadLetterReason ?? "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xxs">
                  {reviewed ? (
                    <span className="inline-flex items-center gap-1 rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 uppercase tracking-wider text-ok">
                      reviewed
                    </span>
                  ) : (
                    <button
                      onClick={() => review(r.id)}
                      disabled={pendingId === r.id}
                      className="rounded border border-volt/50 bg-volt/10 px-2 py-1 uppercase tracking-wider text-volt hover:bg-volt/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingId === r.id ? "marking…" : "mark reviewed"}
                    </button>
                  )}
                  {errors[r.id] ? (
                    <div className="mt-1 max-w-[12rem] truncate text-danger">
                      {errors[r.id]}
                    </div>
                  ) : null}
                  {reviewed && r.reviewedBy ? (
                    <div className="mt-1 text-fg-subtle">
                      by {r.reviewedBy}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-border px-3 py-2 font-mono text-xxs text-fg-subtle">
        Reviewing keeps the record. Items are never deleted from the queue.
      </div>
    </div>
  );
}
