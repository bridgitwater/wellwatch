import { stageLabel, type WellStage } from "@/lib/stages";
import type { WellType } from "@/lib/types";

export function StagePill({ stage, type = "drilled" }: { stage: WellStage; type?: WellType }) {
  const done = stage === "handover";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        done ? "bg-ok-soft text-ok" : "bg-aquifer text-water-deep"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-ok" : "bg-water"}`} />
      {done ? "Complete" : stageLabel(stage, type)}
    </span>
  );
}
