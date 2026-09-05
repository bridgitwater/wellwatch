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
  well_type: WellType;
  people_served: number | null;
  households: number | null;
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

export type WellType = "drilled" | "hand_drilled" | "refurbished" | "solar_system" | "piped_scheme" | "other";

export const WELL_TYPE_LABEL: Record<WellType, string> = {
  drilled: "New drilled borewell",
  hand_drilled: "New hand-drilled borewell",
  refurbished: "Refurbished borewell",
  solar_system: "Solar water system",
  piped_scheme: "Piped water scheme",
  other: "Water project",
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
  well_type: WellType;
  program_name: string | null;
  sponsor_line: string | null;
  people_served: number | null;
  households: number | null;
  depth_m: string | null;
  yield_lph: number | null;
  source_type: string | null;
  pump_type: string | null;
  dedication: string | null;
  summary: string | null;
  before_story: string | null;
  before_distance_km: string | null;
  after_distance_m: number | null;
  hours_saved_day: string | null;
  impacts: string | null;
  wuc_members: number | null;
  wuc_women: number | null;
  wuc_youth: number | null;
  wuc_pwd: number | null;
  wuc_treasurer_woman: boolean | null;
  training_note: string | null;
  sustainability: string | null;
  challenges: string | null;
  lessons: string | null;
  plaque_installed: boolean;
  completed_at: string | null;
  report_file_id: string | null;
  partner_org_id: string | null;
  drive_folder_id: string | null;
  folder_is_public: boolean;
  target_cost: string | null;
  currency: string;
  updated_at: string;
};

/** Staff/partner-only well fields. Funders' role has no SELECT on these columns;
 *  admin pages read them via the well_private_fields() RPC. */
export type WellPrivate = {
  exact_lat: number | null;
  exact_lng: number | null;
  gps_text: string | null;
  contractor: string | null;
};

/** Every wells column the authenticated role may read. `select("*")` on wells
 *  fails since migration 20260905000300 revoked the private columns. */
export const WELL_COLUMNS = [
  "id", "code", "name", "country", "region", "village", "approx_lat", "approx_lng", "status",
  "well_type", "program_name", "sponsor_line", "people_served", "households", "depth_m", "yield_lph",
  "source_type", "pump_type", "dedication", "summary", "before_story", "before_distance_km",
  "after_distance_m", "hours_saved_day", "impacts", "wuc_members", "wuc_women", "wuc_youth", "wuc_pwd",
  "wuc_treasurer_woman", "training_note", "sustainability", "challenges", "lessons", "plaque_installed",
  "completed_at", "report_file_id", "partner_org_id", "drive_folder_id", "folder_is_public", "target_cost",
  "currency", "created_at", "updated_at",
].join(", ");

export type Partner = {
  id: string;
  name: string;
  country: string | null;
  intro: string | null;
  contact_name: string | null;
  contact_title: string | null;
  website: string | null;
  logo_file_id: string | null;
};

export type Testimonial = {
  id: string;
  name: string;
  age: number | null;
  role: string | null;
  quote: string;
  photo_file_id: string | null;
  sort: number;
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
  tag: string | null;
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
