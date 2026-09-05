import type { WellStage } from "./stages";
import type { MediaKind } from "./media";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "field" | "funder";
  organization_id: string | null;
  notify_email: boolean;
};

export type MyWellRow = {
  id: string;
  code: string;
  name: string;
  country: string;
  region: string | null;
  status: WellStage;
  people_served: number | null;
  approx_lat: number | null;
  approx_lng: number | null;
  updated_at: string;
  amount: string | null;
  funded_currency: string;
  funded_at: string | null;
  is_primary: boolean;
  last_update_at: string | null;
  cover_file_id: string | null;
};

export type Well = {
  id: string;
  code: string;
  name: string;
  country: string;
  region: string | null;
  village: string | null;
  approx_lat: number | null;
  approx_lng: number | null;
  status: WellStage;
  people_served: number | null;
  depth_m: string | null;
  yield_lph: number | null;
  source_type: string | null;
  dedication: string | null;
  summary: string | null;
  drive_folder_id: string | null;
  folder_is_public: boolean;
  target_cost: string | null;
  currency: string;
  updated_at: string;
};

export type StageRow = {
  stage: WellStage;
  reached_at: string | null;
  expected_at: string | null;
  note: string | null;
};

export type Media = {
  id: string;
  drive_file_id: string;
  kind: MediaKind;
  mime: string | null;
  name: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  taken_at: string | null;
  caption: string | null;
};

export type Update = {
  id: string;
  stage: WellStage | null;
  body: string | null;
  happened_at: string;
  source: "drive" | "admin" | "whatsapp";
  media: Media[];
};

export type Cost = {
  category: "drilling" | "pump" | "apron_platform" | "training" | "monitoring" | "transport" | "other";
  amount: string;
  currency: string;
  note: string | null;
};

export type WaterTest = {
  tested_at: string;
  ph: string | null;
  turbidity_ntu: string | null;
  e_coli_cfu: number | null;
  fluoride_mgl: string | null;
  arsenic_ugl: string | null;
  passed: boolean | null;
  lab: string | null;
  note: string | null;
};

export type Funding = {
  amount: string | null;
  currency: string;
  funded_at: string | null;
  is_primary: boolean;
};

export const COST_LABEL: Record<Cost["category"], string> = {
  drilling: "Drilling",
  pump: "Hand pump",
  apron_platform: "Apron & platform",
  training: "Community training",
  monitoring: "Monitoring",
  transport: "Transport",
  other: "Other",
};
