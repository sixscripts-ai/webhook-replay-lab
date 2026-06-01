import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/targets", label: "Targets" },
  { href: "/audit", label: "Audit" },
  { href: "/evals", label: "Evals" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-bg-elevated md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <div className="h-2.5 w-2.5 rounded-full bg-volt shadow-[0_0_10px_#c6f24e]" />
          <span className="font-mono text-sm tracking-tight text-fg">
            webhook<span className="text-fg-muted">/</span>replay
          </span>
        </div>
        <nav className="flex-1 px-2 py-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wide text-fg-muted transition-colors hover:bg-bg-panel hover:text-fg"
                >
                  <span className="text-fg-subtle">›</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border p-4">
          <p className="font-mono text-xxs uppercase tracking-wider text-fg-subtle">
            v0.1 · local demo
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-bg/80 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">
              WEBHOOK REPLAY LAB
            </span>
            <span className="rounded border border-volt/30 bg-volt/10 px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider text-volt">
              live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/health"
              className="font-mono text-xxs uppercase tracking-widest text-fg-muted hover:text-volt"
              target="_blank"
              rel="noreferrer"
            >
              /api/health
            </a>
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-bg">{children}</main>
      </div>
    </div>
  );
}
