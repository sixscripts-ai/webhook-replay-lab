type Status = "received" | "delivered" | "failed" | "replayed";

const styles: Record<Status, string> = {
  received: "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted",
  delivered: "border-ok/40 bg-ok/10 text-ok",
  failed: "border-danger/50 bg-danger/10 text-danger",
  replayed: "border-volt/50 bg-volt/10 text-volt",
};

export function EventStatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
