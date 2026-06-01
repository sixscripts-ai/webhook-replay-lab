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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
              <th className="w-[28%] px-3 py-2.5 text-left">Event</th>
              <th className="w-[12%] px-3 py-2.5 text-left">Provider</th>
              <th className="w-[8%] px-3 py-2.5 text-center">Attempts</th>
              <th className="w-[16%] px-3 py-2.5 text-left">Last Attempt</th>
              <th className="w-[20%] px-3 py-2.5 text-left">Reason</th>
              <th className="w-[16%] px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
        <tbody>
          {rows.map((r, idx) => {
            const ts = r.deadLetteredAt
              ? typeof r.deadLetteredAt === "string"
                ? new Date(r.deadLetteredAt)
                : r.deadLetteredAt
              : null;
            const reviewed = r.reviewedAt != null;
            const reviewedTs = r.reviewedAt
              ? typeof r.reviewedAt === "string"
                ? new Date(r.reviewedAt)
                : r.reviewedAt
              : null;
            return (
              <tr
                key={r.id}
                className={`border-b border-border last:border-0 align-top ${
                  idx % 2 === 1 ? "bg-bg-panel/20" : ""
                } ${reviewed ? "opacity-80" : ""}`}
              >
                <td className="px-3 py-3">
                  <Link
                    href={`/events/${r.id}`}
                    className="block font-mono text-xs text-fg hover:text-volt"
                  >
                    <span className="text-volt">›</span>{" "}
                    <span className="text-fg">{r.eventType}</span>
                  </Link>
                  <div className="mt-1 truncate font-mono text-xxs text-fg-subtle">
                    {r.id}
                  </div>
                  {r.targetName ? (
                    <div className="mt-1 truncate font-mono text-xxs text-fg-muted">
                      → {r.targetName}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="rounded border border-border bg-bg-panel px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider text-fg-muted">
                    {r.provider}
                  </span>
                </td>
                <td className="px-3 py-3 text-center align-top font-mono text-sm tabular-nums text-fg">
                  {r.attemptsCount}
                </td>
                <td className="px-3 py-3 align-top font-mono text-xxs text-fg-muted">
                  {ts
                    ? ts.toISOString().slice(0, 19).replace("T", " ") + " UTC"
                    : "—"}
                </td>
                <td className="px-3 py-3 align-top font-mono text-xxs leading-snug text-danger">
                  {r.deadLetterReason ?? "—"}
                </td>
                <td className="px-3 py-3 text-right align-top font-mono text-xxs">
                  {reviewed ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 rounded border border-ok/40 bg-ok/10 px-2 py-0.5 uppercase tracking-wider text-ok">
                        ✓ reviewed
                      </span>
                      {r.reviewedBy ? (
                        <span className="text-fg-subtle">
                          by {r.reviewedBy}
                          {reviewedTs
                            ? ` · ${reviewedTs
                                .toISOString()
                                .slice(0, 10)}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div className="border-t border-border bg-bg-panel/40 px-3 py-2 font-mono text-xxs text-fg-subtle">
        Reviewing keeps the record. Items are never deleted from the queue.
      </div>
    </div>
  );
}
