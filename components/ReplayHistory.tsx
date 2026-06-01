type Attempt = {
  id: string;
  status: "success" | "failed";
  responseStatus?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  attemptedAt: Date | string;
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

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            <th className="w-[18%] px-3 py-2 text-left">When</th>
            <th className="w-[14%] px-3 py-2 text-left">Status</th>
            <th className="w-[10%] px-3 py-2 text-left">Code</th>
            <th className="w-[10%] px-3 py-2 text-left">Duration</th>
            <th className="w-[24%] px-3 py-2 text-left">Target</th>
            <th className="w-[24%] px-3 py-2 text-left">Note</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const ts =
              typeof a.attemptedAt === "string"
                ? new Date(a.attemptedAt)
                : a.attemptedAt;
            const tone =
              a.status === "success"
                ? "border-ok/40 bg-ok/10 text-ok"
                : "border-danger/50 bg-danger/10 text-danger";
            return (
              <tr
                key={a.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                  {ts.toISOString().slice(0, 19).replace("T", " ")}
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
                <td className="truncate px-3 py-2 font-mono text-xxs text-fg-muted">
                  {a.target ? a.target.name : "—"}
                </td>
                <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                  {a.errorMessage ?? "ok"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
