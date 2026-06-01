"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AssertionEvidence = {
  type: "statusEquals" | "bodyIncludes" | "responseTimeLessThanMs";
  expected: number | string;
  actual: number | string | null;
  passed: boolean;
  detail?: string;
};

export type EvalRow = {
  id: string;
  name: string;
  description: string | null;
  targetName: string | null;
  provider: string | null;
  expectedStatus: number;
  expectedBodyIncludes: string | null;
  expectedMaxDurationMs: number | null;
  isActive: boolean;
  hasEvent: boolean;
  latest: {
    status: "pass" | "fail";
    actualStatus: number | null;
    notes: string | null;
    createdAt: Date | string;
    assertions: AssertionEvidence[];
  } | null;
  history: {
    id: string;
    status: "pass" | "fail";
    actualStatus: number | null;
    createdAt: Date | string;
    notes: string | null;
    assertions: AssertionEvidence[];
  }[];
};

export function EvalsManager({ initial }: { initial: EvalRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  async function run(id: string) {
    setPendingId(id);
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/evals/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Run failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [id]: err instanceof Error ? err.message : "Run failed",
      }));
    } finally {
      setPendingId(null);
    }
  }

  if (!initial.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 px-4 py-8 text-center font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        no eval test cases · seed demo data
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            <th className="w-[22%] px-3 py-2 text-left">Test Case</th>
            <th className="w-[16%] px-3 py-2 text-left">Target / Provider</th>
            <th className="w-[10%] px-3 py-2 text-left">Result</th>
            <th className="w-[38%] px-3 py-2 text-left">Latest Assertions</th>
            <th className="w-[14%] px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {initial.map((c) => {
            const result = c.latest?.status ?? (c.isActive ? "ready" : "inactive");
            const tone =
              result === "pass"
                ? "border-ok/40 bg-ok/10 text-ok"
                : result === "fail"
                ? "border-danger/50 bg-danger/10 text-danger"
                : result === "ready"
                ? "border-volt/50 bg-volt/10 text-volt"
                : "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted";
            const open = openId === c.id;
            const planned = plannedAssertions(c);
            return (
              <Fragment key={c.id}>
                <tr className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-fg">{c.name}</div>
                    {c.description ? (
                      <div className="mt-1 font-mono text-xxs text-fg-subtle">
                        {c.description}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1 font-mono text-xxs text-fg-subtle">
                      {planned.map((p, i) => (
                        <span
                          key={i}
                          className="rounded border border-border bg-bg-panel px-1.5 py-0.5 uppercase tracking-wider"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                    {c.targetName ?? "—"}
                    <div className="text-fg-subtle">{c.provider ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${tone}`}
                    >
                      {result}
                    </span>
                    {c.latest?.actualStatus != null ? (
                      <div className="mt-1 font-mono text-xxs text-fg-muted">
                        actual: {c.latest.actualStatus}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xxs">
                    {c.latest?.assertions?.length ? (
                      <ul className="space-y-0.5">
                        {c.latest.assertions.map((a, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 inline-flex items-center rounded border px-1 py-px uppercase tracking-wider ${
                                a.passed
                                  ? "border-ok/40 bg-ok/10 text-ok"
                                  : "border-danger/50 bg-danger/10 text-danger"
                              }`}
                            >
                              {a.passed ? "ok" : "fail"}
                            </span>
                            <span className="text-fg-muted">
                              {a.type}{" "}
                              <span className="text-fg-subtle">
                                {a.detail ?? ""}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-fg-subtle">
                        {c.latest?.notes ?? "no run recorded"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xxs">
                    <button
                      onClick={() => run(c.id)}
                      disabled={!c.hasEvent || pendingId === c.id}
                      className="mr-2 rounded border border-volt/50 bg-volt/10 px-2 py-1 uppercase tracking-wider text-volt hover:bg-volt/20 disabled:cursor-not-allowed disabled:opacity-50"
                      title={!c.hasEvent ? "no event linked" : undefined}
                    >
                      {pendingId === c.id ? "running…" : "▶ run"}
                    </button>
                    {c.history.length ? (
                      <button
                        onClick={() => setOpenId(open ? null : c.id)}
                        className="rounded border border-border px-2 py-1 uppercase tracking-wider text-fg-muted hover:border-volt hover:text-volt"
                      >
                        {open ? "hide" : "history"}
                      </button>
                    ) : null}
                    {errors[c.id] ? (
                      <div className="mt-1 max-w-[12rem] truncate text-danger">
                        {errors[c.id]}
                      </div>
                    ) : null}
                  </td>
                </tr>
                {open ? (
                  <tr className="border-b border-border last:border-0 bg-bg-panel/40">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                        recent runs
                      </div>
                      <table className="mt-2 w-full table-fixed border-collapse">
                        <thead>
                          <tr className="border-b border-border font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                            <th className="w-[20%] px-2 py-1 text-left">When</th>
                            <th className="w-[10%] px-2 py-1 text-left">Result</th>
                            <th className="w-[10%] px-2 py-1 text-left">Actual</th>
                            <th className="w-[60%] px-2 py-1 text-left">Assertions / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.history.slice(0, 10).map((h) => {
                            const ts =
                              typeof h.createdAt === "string"
                                ? new Date(h.createdAt)
                                : h.createdAt;
                            return (
                              <tr key={h.id} className="border-b border-border last:border-0 align-top">
                                <td className="px-2 py-1 font-mono text-xxs text-fg-muted">
                                  {ts.toISOString().slice(0, 19).replace("T", " ")}
                                </td>
                                <td className="px-2 py-1 font-mono text-xxs">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 uppercase tracking-wider ${
                                      h.status === "pass"
                                        ? "border-ok/40 bg-ok/10 text-ok"
                                        : "border-danger/50 bg-danger/10 text-danger"
                                    }`}
                                  >
                                    {h.status}
                                  </span>
                                </td>
                                <td className="px-2 py-1 font-mono text-xxs text-fg-muted">
                                  {h.actualStatus ?? "—"}
                                </td>
                                <td className="px-2 py-1 font-mono text-xxs text-fg-subtle">
                                  {h.assertions?.length ? (
                                    <ul className="space-y-0.5">
                                      {h.assertions.map((a, i) => (
                                        <li key={i}>
                                          <span
                                            className={
                                              a.passed
                                                ? "text-ok"
                                                : "text-danger"
                                            }
                                          >
                                            {a.passed ? "✓" : "✗"}
                                          </span>{" "}
                                          {a.type} — {a.detail ?? ""}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    h.notes ?? "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-border px-3 py-2 font-mono text-xxs text-fg-subtle">
        Run executes a real replay against the linked target and records each assertion as evidence.
      </div>
    </div>
  );
}

function plannedAssertions(c: EvalRow): string[] {
  const out: string[] = [`statusEquals=${c.expectedStatus}`];
  if (c.expectedBodyIncludes) {
    const s = c.expectedBodyIncludes;
    out.push(`bodyIncludes="${s.length > 24 ? s.slice(0, 24) + "…" : s}"`);
  }
  if (c.expectedMaxDurationMs) {
    out.push(`responseTime<${c.expectedMaxDurationMs}ms`);
  }
  return out;
}
