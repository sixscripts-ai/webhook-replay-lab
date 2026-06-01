import { unstable_noStore as noStore } from "next/cache";
import { SectionHeader } from "@/components/SectionHeader";
import { prisma } from "@/lib/db";
import { TargetsManager } from "@/components/TargetsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TargetsPage() {
  noStore();
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
    isRetryEnabled: t.isRetryEnabled,
    maxAttempts: t.maxAttempts,
    backoffStrategy: t.backoffStrategy as "none" | "fixed" | "exponential",
    backoffBaseMs: t.backoffBaseMs,
    timeoutMs: t.timeoutMs,
    retryOnStatuses: Array.isArray(t.retryOnStatuses)
      ? (t.retryOnStatuses as number[])
      : [],
    isSignatureVerificationEnabled: t.isSignatureVerificationEnabled,
    signatureHeaderName: t.signatureHeaderName ?? null,
    signatureAlgorithm: t.signatureAlgorithm ?? null,
    signingSecretEnvVar: t.signingSecretEnvVar ?? null,
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
        description="Configured endpoints used when replaying webhook events. Configure retry policy, signature verification, and active state per target."
      />
      <div className="px-6 py-6">
        <TargetsManager initial={rows} />
      </div>
    </div>
  );
}
