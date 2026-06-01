import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const targets = await prisma.replayTarget.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      replayAttempts: {
        orderBy: { attemptedAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="targets"
        title="Replay Targets"
        description="Configured endpoints used when replaying webhook events."
      />
      <div className="px-6 py-6">
        {targets.length ? (
          <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                  <th className="w-[24%] px-3 py-2 text-left">Name</th>
                  <th className="w-[18%] px-3 py-2 text-left">Provider</th>
                  <th className="w-[34%] px-3 py-2 text-left">URL</th>
                  <th className="w-[12%] px-3 py-2 text-left">Active</th>
                  <th className="w-[12%] px-3 py-2 text-left">Last Replay</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => {
                  const last = t.replayAttempts[0];
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-fg">{t.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                        {t.provider}
                      </td>
                      <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                        {t.url}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xxs uppercase tracking-wider ${
                            t.isActive
                              ? "border-ok/40 bg-ok/10 text-ok"
                              : "border-fg-subtle/40 bg-fg-subtle/10 text-fg-muted"
                          }`}
                        >
                          {t.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                        {last
                          ? `${last.status} · ${last.responseStatus ?? "—"}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-border px-3 py-2 font-mono text-xxs text-fg-subtle">
              Target creation is planned. This demo uses seeded targets to show replay behavior.
            </div>
          </div>
        ) : (
          <EmptyState
            title="No replay targets configured"
            description="Target creation is planned. This demo uses seeded targets to show replay behavior."
          />
        )}
      </div>
    </div>
  );
}
