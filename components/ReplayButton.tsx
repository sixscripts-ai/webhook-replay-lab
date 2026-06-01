"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: string;
  disabled?: boolean;
  label?: string;
};

export function ReplayButton({ eventId, disabled, label = "Replay" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    status: string;
    responseStatus?: number;
    durationMs?: number;
  } | null>(null);

  async function trigger() {
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/replay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Replay failed (${res.status})`);
      }
      setLastResult({
        status: data.status,
        responseStatus: data.responseStatus,
        durationMs: data.durationMs,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={trigger}
        disabled={disabled || pending}
        className="rounded border border-volt/50 bg-volt/10 px-3 py-1.5 font-mono text-xxs uppercase tracking-widest text-volt transition-all hover:border-volt hover:bg-volt/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "replaying…" : `↻ ${label}`}
      </button>
      {lastResult ? (
        <div className="font-mono text-xxs text-fg-muted">
          {lastResult.status === "success" ? "✓" : "✗"}{" "}
          <span className="text-fg-subtle">
            {lastResult.responseStatus ?? "—"} · {lastResult.durationMs ?? 0}ms
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="max-w-xs truncate font-mono text-xxs text-danger">
          {error}
        </div>
      ) : null}
    </div>
  );
}
