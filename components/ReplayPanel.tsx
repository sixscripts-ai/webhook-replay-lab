"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Target = {
  id: string;
  name: string;
  provider: string;
  url: string;
  isActive: boolean;
};

type Result = {
  status: string;
  responseStatus?: number;
  durationMs?: number;
  responseBody?: string;
  errorMessage?: string;
};

export function ReplayPanel({
  eventId,
  eventProvider,
  defaultTargetId,
  targets,
  canReplay,
  disabledReason,
}: {
  eventId: string;
  eventProvider: string;
  defaultTargetId?: string | null;
  targets: Target[];
  canReplay: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const sortedTargets = useMemo(() => {
    const active = targets.filter((t) => t.isActive);
    const matching = active.filter((t) => t.provider === eventProvider);
    const others = active.filter((t) => t.provider !== eventProvider);
    return [...matching, ...others];
  }, [targets, eventProvider]);

  const initialTargetId =
    defaultTargetId && sortedTargets.find((t) => t.id === defaultTargetId)?.id
      ? defaultTargetId
      : sortedTargets[0]?.id ?? "";

  const [targetId, setTargetId] = useState<string>(initialTargetId);
  const noActive = sortedTargets.length === 0;

  async function trigger() {
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/replay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: targetId || undefined }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 502) {
        throw new Error(data?.error ?? `Replay failed (${res.status})`);
      }
      setResult({
        status: data.status,
        responseStatus: data.responseStatus,
        durationMs: data.durationMs,
        responseBody: data.responseBody,
        errorMessage: data.errorMessage,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (noActive) {
    return (
      <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 p-3 font-mono text-xxs text-fg-muted">
        No active replay targets.{" "}
        <a href="/targets" className="text-volt hover:underline">
          Add one on the Targets page
        </a>{" "}
        to enable replay.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-bg-elevated p-3">
      <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        replay to target
      </div>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg focus:border-volt focus:outline-none"
      >
        {sortedTargets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.provider === eventProvider ? "★ " : ""}
            {t.name} · {t.provider}
          </option>
        ))}
      </select>
      <button
        onClick={trigger}
        disabled={!canReplay || submitting || pending}
        className="w-full rounded border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-volt hover:bg-volt/20 disabled:cursor-not-allowed disabled:opacity-50"
        title={!canReplay ? disabledReason : undefined}
      >
        {submitting ? "replaying…" : "↻ replay event"}
      </button>
      {!canReplay && disabledReason ? (
        <div className="font-mono text-xxs text-fg-subtle">{disabledReason}</div>
      ) : null}
      {result ? (
        <div className="space-y-1 border-t border-border pt-2">
          <div className="font-mono text-xxs">
            {result.status === "success" ? (
              <span className="text-ok">✓ success</span>
            ) : (
              <span className="text-danger">✗ failed</span>
            )}{" "}
            <span className="text-fg-subtle">
              · {result.responseStatus ?? "—"} · {result.durationMs ?? 0}ms
            </span>
          </div>
          {result.errorMessage ? (
            <div className="font-mono text-xxs text-danger">{result.errorMessage}</div>
          ) : null}
          {result.responseBody ? (
            <pre className="max-h-40 overflow-auto rounded border border-border bg-bg p-2 font-mono text-xxs text-fg-muted">
              {result.responseBody.slice(0, 400)}
            </pre>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="border-t border-border pt-2 font-mono text-xxs text-danger">
          {error}
        </div>
      ) : null}
    </div>
  );
}
