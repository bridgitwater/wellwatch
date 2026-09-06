export type WellStage =
  | "funded"
  | "survey"
  | "drilling"
  | "pump_apron"
  | "water_flowing"
  | "handover";

export const STAGE_ORDER: WellStage[] = [
  "funded",
  "survey",
  "drilling",
  "pump_apron",
  "water_flowing",
  "handover",
];

export const STAGE_LABEL: Record<WellStage, string> = {
  funded: "Funded",
  survey: "Site survey",
  drilling: "Drilling",
  pump_apron: "Pump & platform",
  water_flowing: "Water flowing",
  handover: "Handed to the community",
};

/** One-line, funder-facing description of what happens in each stage. */
export const STAGE_BLURB: Record<WellStage, string> = {
  funded: "Your gift has been received. Our local partner schedules the site visit.",
  survey: "A hydrogeologist and the community agree where the well goes.",
  drilling: "The rig arrives and drills down to the water-bearing rock, usually 40–80 metres.",
  pump_apron: "The hand pump is fitted and a concrete platform keeps the site clean and dry.",
  water_flowing: "First water. The flow and water quality are tested.",
  handover: "A trained community water committee takes over caring for the well.",
};

export function stageIndex(stage: WellStage) {
  return STAGE_ORDER.indexOf(stage);
}

/** Which stage a well was in on a given date, from its stage history. */
export function stageOn(
  history: { stage: WellStage; reached_at: string | null }[],
  date: Date,
): WellStage {
  let current: WellStage = "funded";
  for (const s of STAGE_ORDER) {
    const row = history.find((h) => h.stage === s);
    if (row?.reached_at && new Date(row.reached_at) <= date) current = s;
  }
  return current;
}

import type { WellType } from "./types";

/** Stage labels and blurbs read differently for a repair than for a new borehole. */
export function stageLabel(stage: WellStage, type: WellType = "drilled"): string {
  if (type === "refurbished") {
    return ({ drilling: "Repair works", pump_apron: "New pump & platform", survey: "Assessment" } as Partial<Record<WellStage, string>>)[stage] ?? STAGE_LABEL[stage];
  }
  if (type === "solar_system" || type === "piped_scheme") {
    return ({ pump_apron: "Pump, tank & taps" } as Partial<Record<WellStage, string>>)[stage] ?? STAGE_LABEL[stage];
  }
  if (type === "hand_drilled") {
    return ({ drilling: "Hand drilling" } as Partial<Record<WellStage, string>>)[stage] ?? STAGE_LABEL[stage];
  }
  return STAGE_LABEL[stage];
}

export function stageBlurb(stage: WellStage, type: WellType = "drilled"): string {
  if (type === "refurbished") {
    return ({
      survey: "The team inspects the broken well and agrees the repair with the community.",
      drilling: "Old rods, pipes and cylinder come out; the well is flushed and checked.",
      pump_apron: "A new pump head and downhole parts go in; the platform and drainage are rebuilt.",
    } as Partial<Record<WellStage, string>>)[stage] ?? STAGE_BLURB[stage];
  }
  if (type === "hand_drilled") {
    return ({
      drilling: "A crew of five to seven drills by hand to about 40 metres, then cases and gravel-packs the hole.",
    } as Partial<Record<WellStage, string>>)[stage] ?? STAGE_BLURB[stage];
  }
  if (type === "solar_system") {
    return ({
      pump_apron: "A submersible pump, solar panels, storage tank and tap stands are installed.",
    } as Partial<Record<WellStage, string>>)[stage] ?? STAGE_BLURB[stage];
  }
  return STAGE_BLURB[stage];
}
