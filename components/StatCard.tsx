type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "ok" | "danger" | "warn" | "volt";
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-fg",
  ok: "text-ok",
  danger: "text-danger",
  warn: "text-warn",
  volt: "text-volt",
};

export function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated p-5 transition-colors hover:border-border-strong">
      <div className="font-mono text-xxs uppercase tracking-widest text-fg-muted">
        {label}
      </div>
      <div className={`mt-3 font-mono text-3xl tabular-nums ${toneClasses[tone]}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-2 font-mono text-xxs text-fg-subtle">{hint}</div>
      ) : null}
    </div>
  );
}
