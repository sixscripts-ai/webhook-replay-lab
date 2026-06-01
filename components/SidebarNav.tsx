"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="flex-1 px-2 py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-bg-panel text-fg shadow-[inset_2px_0_0_0_#c6f24e]"
                    : "text-fg-muted hover:bg-bg-panel/60 hover:text-fg"
                }`}
              >
                <span className={active ? "text-volt" : "text-fg-subtle"}>›</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
