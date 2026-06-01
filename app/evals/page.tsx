import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default function EvalsPage() {
  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="evalbench lite"
        title="Replay Evaluations"
        description="Define replay test cases with expected status codes and body contents. Each run records pass/fail evidence."
      />
      <div className="px-6 py-8">
        <EmptyState
          title="EvalBench Lite arrives in Milestone 2"
          description="Webhook capture, the inbox, event detail, and replay are live in Milestone 1. EvalBench Lite (test cases + run history + pass/fail evidence) ships next."
        />
      </div>
    </div>
  );
}
