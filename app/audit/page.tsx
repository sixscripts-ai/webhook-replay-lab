import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="audit"
        title="Audit Log"
        description="Every significant action — event ingestion, replays, target changes, and eval runs."
      />
      <div className="px-6 py-6">
        {logs.length ? (
          <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-panel/60 font-mono text-xxs uppercase tracking-widest text-fg-subtle">
                  <th className="w-[18%] px-3 py-2 text-left">When</th>
                  <th className="w-[12%] px-3 py-2 text-left">Actor</th>
                  <th className="w-[20%] px-3 py-2 text-left">Action</th>
                  <th className="w-[14%] px-3 py-2 text-left">Entity</th>
                  <th className="w-[14%] px-3 py-2 text-left">ID</th>
                  <th className="w-[22%] px-3 py-2 text-left">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                      {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                      {l.actor}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-fg">
                      {l.action}
                    </td>
                    <td className="px-3 py-2 font-mono text-xxs text-fg-muted">
                      {l.entityType}
                    </td>
                    <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                      {l.entityId}
                    </td>
                    <td className="truncate px-3 py-2 font-mono text-xxs text-fg-subtle">
                      {JSON.stringify(l.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No audit entries yet"
            description="Send a webhook or trigger a replay to populate the audit log."
          />
        )}
      </div>
    </div>
  );
}
