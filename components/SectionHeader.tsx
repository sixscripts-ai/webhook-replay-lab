type SectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
};

export function SectionHeader({
  title,
  description,
  actions,
  eyebrow,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-bg-elevated/40 px-6 py-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <div className="font-mono text-xxs uppercase tracking-widest text-fg-subtle">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-1 font-mono text-xl text-fg">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
