import { SectionHeader } from "@/components/SectionHeader";
import { prisma } from "@/lib/db";
import { TargetsManager } from "@/components/TargetsManager";

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

  const rows = targets.map((t) => ({
    id: t.id,
    name: t.name,
    provider: t.provider,
    url: t.url,
    isActive: t.isActive,
    lastReplay: t.replayAttempts[0]
      ? {
          status: t.replayAttempts[0].status,
          responseStatus: t.replayAttempts[0].responseStatus,
        }
      : null,
  }));

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="targets"
        title="Replay Targets"
        description="Configured endpoints used when replaying webhook events. Create, edit, and toggle targets directly."
      />
      <div className="px-6 py-6">
        <TargetsManager initial={rows} />
      </div>
    </div>
  );
}
