type Attempt = {
  id: string;
  status: "success" | "failed";
  responseStatus?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  attemptedAt: Date | string;
  attemptNumber?: number | null;
  isAutomatic?: boolean | null;
  backoffDelayMs?: number | null;
  runId?: string | null;
  target?: { name: string; url: string } | null;
};

export function ReplayHistory({ attempts }: { attempts: Attempt[] }) {
  if (!attempts.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 px-4 py-6 text-center font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        no replay attempts yet
      </div>
    );
  }

  // Group by runId so retries from one replay invocation are visually clustered.
  // Standalone (no runId) attempts are emitted individually.
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const key = a.runId ? `run:${a.runId}` : `solo:${a.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  // Order groups by their newest attempt time desc.
  const orderedGroups = Array.from(groups.entries()).sort((a, b) => {
    const at = Math.max(
      ...a[1].map((x) =>
        (typeof x.attemptedAt === "string"
          ? new Date(x.attemptedAt)
          : x.attemptedAt
        ).getTime()
      )
    );
    const bt = Math.max(
      ...b[1].map((x) =>
        (typeof x.attemptedAt === "string"
          ? new Date(x.attemptedAt)
          : x.attemptedAt
        ).getTime()
      )
    );
    return bt - at;
  });

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            <th className="w-[16%] px-3 py-2 text-left">When</th>
            <th className="w-[8%] px-3 py-2 text-left">#</th>
            <th className="w-[10%] px-3 py-2 text-left">Status</th>
            <th className="w-[8%] px-3 py-2 text-left">Code</th>
            <th className="w-[10%] px-3 py-2 text-left">Duration</th>
            <th className="w-[10%] px-3 py-2 text-left">Backoff</th>
            <th className="w-[14%] px-3 py-2 text-left">Target</th>
            <th className="w-[24%] px-3 py-2 text-left">Response / Error</th>
          </tr>
        </thead>
        <tbody>
          {orderedGroups.map(([, groupAttempts]) => {
            // Sort attempts within run ascending by attemptNumber.
            const sorted = [...groupAttempts].sort((a, b) => {
              const an = a.attemptNumber ?? 1;
              const bn = b.attemptNumber ?? 1;
              return an - bn;
            });
            return sorted.map((a, idx) => {
              const ts =
                typeof a.attemptedAt === "string"
                  ? new Date(a.attemptedAt)
                  : a.attemptedAt;
              const tone =
                a.status === "success"
                  ? "border-ok/40 bg-ok/10 text-ok"
                  : "border-danger/50 bg-danger/10 text-danger";
              const note =
                a.status === "failed" && a.errorMessage
                  ? a.errorMessage
                  : a.responseBody
                  ? a.responseBody.slice(0, 200)
                  : a.status === "success"
                  ? "ok"
                  : "—";
              const isFirstInGroup = idx === 0;
              return (
                <tr
                  key={a.id}
                  className={`border-b border-border last:border-0 align-top ${
                    !isFirstInGroup ? "bg-bg-panel/30" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                    {ts.toISOString().slice(0, 19).replace("T", " ")}
                    {a.runId && isFirstInGroup ? (
                      <div className="font-mono text-xxs text-fg-subtle">
                        run {a.runId.slice(0, 8)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xxs text-fg">
                    #{a.attemptNumber ?? 1}
                    {a.isAutomatic ? (
                      <span className="ml-1 rounded border border-warn/40 bg-warn/10 px-1 py-px text-xxs uppercase tracking-wider text-warn">
                        auto
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${tone}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-fg">
                    {a.responseStatus ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                    {a.durationMs != null ? `${a.durationMs}ms` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                    {a.backoffDelayMs != null && a.backoffDelayMs > 0
                      ? `${a.backoffDelayMs}ms`
                      : "—"}
                  </td>
                  <td className="truncate px-3 py-2 font-mono text-xxs text-fg-muted">
                    {a.target ? a.target.name : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xxs text-fg-subtle">
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all">
                      {note}
                    </pre>
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
