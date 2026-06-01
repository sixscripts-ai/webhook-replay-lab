type TimelineKind =
  | "received"
  | "signature_verified"
  | "signature_failed"
  | "duplicate_detected"
  | "replay_started"
  | "replay_attempt"
  | "retry_scheduled"
  | "replay_success"
  | "replay_failed"
  | "dead_lettered"
  | "dead_letter_reviewed"
  | "eval_started"
  | "eval_passed"
  | "eval_failed"
  | "audit";

export type TimelineItem = {
  at: Date | string;
  kind: TimelineKind;
  title: string;
  description?: string | null;
  metadata?: string | null;
};

const TONE: Record<TimelineKind, string> = {
  received: "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted",
  signature_verified: "border-ok/40 bg-ok/10 text-ok",
  signature_failed: "border-danger/50 bg-danger/10 text-danger",
  duplicate_detected: "border-warn/40 bg-warn/10 text-warn",
  replay_started: "border-volt/50 bg-volt/10 text-volt",
  replay_attempt: "border-fg-subtle/40 bg-bg-panel text-fg-muted",
  retry_scheduled: "border-warn/40 bg-warn/10 text-warn",
  replay_success: "border-ok/40 bg-ok/10 text-ok",
  replay_failed: "border-danger/50 bg-danger/10 text-danger",
  dead_lettered: "border-danger/50 bg-danger/10 text-danger",
  dead_letter_reviewed: "border-ok/40 bg-ok/10 text-ok",
  eval_started: "border-volt/50 bg-volt/10 text-volt",
  eval_passed: "border-ok/40 bg-ok/10 text-ok",
  eval_failed: "border-danger/50 bg-danger/10 text-danger",
  audit: "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted",
};

const LABEL: Record<TimelineKind, string> = {
  received: "received",
  signature_verified: "signature ok",
  signature_failed: "signature failed",
  duplicate_detected: "duplicate",
  replay_started: "replay start",
  replay_attempt: "attempt",
  retry_scheduled: "retry scheduled",
  replay_success: "replay ok",
  replay_failed: "replay failed",
  dead_lettered: "dead-lettered",
  dead_letter_reviewed: "reviewed",
  eval_started: "eval start",
  eval_passed: "eval pass",
  eval_failed: "eval fail",
  audit: "audit",
};

export function EventTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-bg-elevated/40 px-4 py-6 text-center font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        no timeline data
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-5">
      {items.map((it, idx) => {
        const ts = typeof it.at === "string" ? new Date(it.at) : it.at;
        const tone = TONE[it.kind];
        return (
          <li key={idx} className="relative">
            <span
              className={`absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full border ${tone}`}
              aria-hidden
            />
            <div className="rounded-md border border-border bg-bg-elevated p-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${tone}`}
                  >
                    {LABEL[it.kind]}
                  </span>
                  <span className="font-mono text-xs text-fg">{it.title}</span>
                </div>
                <time
                  dateTime={ts.toISOString()}
                  title={ts.toISOString()}
                  className="font-mono text-xxs text-fg-subtle"
                >
                  {ts.toISOString().slice(0, 19).replace("T", " ")}
                </time>
              </div>
              {it.description ? (
                <div className="mt-1 font-mono text-xxs text-fg-muted">
                  {it.description}
                </div>
              ) : null}
              {it.metadata ? (
                <div className="mt-1 truncate font-mono text-xxs text-fg-subtle">
                  {it.metadata}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
