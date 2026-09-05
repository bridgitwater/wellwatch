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
  pump_apron: "Pump & apron",
  water_flowing: "Water flowing",
  handover: "Handover",
};

/** One-line, funder-facing description of what happens in each stage. */
export const STAGE_BLURB: Record<WellStage, string> = {
  funded: "Your gift is in. The partner team schedules the site visit.",
  survey: "A hydrogeologist and the community agree where the borehole goes.",
  drilling: "The rig arrives and drills until it hits clean water.",
  pump_apron: "The hand pump is fitted and a concrete apron keeps the site clean.",
  water_flowing: "First water. Yield and quality are tested.",
  handover: "A trained water committee takes ownership for the long term.",
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
