type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-bg-elevated/40 px-6 py-12 text-center">
      <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
        no records
      </div>
      <div className="font-mono text-base text-fg">{title}</div>
      {description ? (
        <p className="max-w-md text-sm text-fg-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
