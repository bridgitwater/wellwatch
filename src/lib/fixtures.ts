/**
 * In-memory sample data mirroring supabase/seed.sql, for previewing the UI with
 * WELLWATCH_FIXTURES=1 and no Supabase project. Never active in production.
 */
import type { WellPage } from "./data";
import type { MyWellRow, Profile } from "./types";

export const fixturesEnabled = () =>
  process.env.WELLWATCH_FIXTURES === "1" && process.env.NODE_ENV !== "production";

export const fixtureProfile: Profile = {
  id: "10000000-0000-0000-0000-000000000011",
  email: "funder.one@example.com",
  display_name: "Margaret Chen",
  role: "funder",
  organization_id: null,
  notify_email: true,
};

const kyabirwa: WellPage = {
  well: {
    id: "20000000-0000-0000-0000-000000000001",
    code: "UG-2026-014",
    name: "Kyabirwa",
    country: "UG",
    region: "Jinja District",
    village: "Kyabirwa",
    approx_lat: 0.4855,
    approx_lng: 33.1912,
    status: "handover",
    people_served: 640,
    depth_m: "48.0",
    yield_lph: 1200,
    source_type: "Borehole with India Mark II hand pump",
    dedication: "In memory of Robert Chen",
    summary: "A farming village on the east bank of the Nile. Until now women walked 2.5 km to an unprotected spring.",
    drive_folder_id: null,
    folder_is_public: true,
    target_cost: "9800",
    currency: "AUD",
    updated_at: "2026-07-19T00:00:00Z",
  },
  stages: [
    { stage: "funded", reached_at: "2026-06-15", expected_at: null, note: null },
    { stage: "survey", reached_at: "2026-06-24", expected_at: null, note: "Hydrogeological survey; site chosen beside the school" },
    { stage: "drilling", reached_at: "2026-07-06", expected_at: null, note: "Water struck at 42 m, drilled to 48 m" },
    { stage: "pump_apron", reached_at: "2026-07-11", expected_at: null, note: null },
    { stage: "water_flowing", reached_at: "2026-07-12", expected_at: null, note: "Yield test 1,200 L/h" },
    { stage: "handover", reached_at: "2026-07-19", expected_at: null, note: "Water committee of 7 trained; 4 women" },
  ],
  updates: [
    {
      id: "u4", stage: "handover", source: "drive", happened_at: "2026-07-19T11:00:00Z",
      body: "Handover ceremony. The water committee (four women, three men) has been trained on pump maintenance and will collect a small monthly fee for repairs.",
      media: [
        { id: "m6", drive_file_id: "seed-kyabirwa-hand-1", kind: "photo", mime: "image/jpeg", name: "IMG_4210.jpg", width: 1600, height: 1200, duration_s: null, taken_at: "2026-07-19T10:20:00Z", caption: null },
        { id: "m7", drive_file_id: "seed-kyabirwa-hand-2", kind: "photo", mime: "image/jpeg", name: "IMG_4215.jpg", width: 1600, height: 1200, duration_s: null, taken_at: "2026-07-19T10:45:00Z", caption: null },
      ],
    },
    {
      id: "u3", stage: "water_flowing", source: "drive", happened_at: "2026-07-12T08:00:00Z",
      body: "First clean water. Yield test came back at 1,200 litres an hour, more than enough for the whole village.",
      media: [{ id: "m5", drive_file_id: "seed-kyabirwa-water-1", kind: "photo", mime: "image/jpeg", name: "IMG_4160.jpg", width: 1600, height: 1200, duration_s: null, taken_at: "2026-07-12T07:30:00Z", caption: null }],
    },
    {
      id: "u2", stage: "drilling", source: "drive", happened_at: "2026-07-06T12:30:00Z",
      body: "Rig arrived at 7am. Hit water at 42 metres — big cheer from everyone watching.",
      media: [
        { id: "m2", drive_file_id: "seed-kyabirwa-drill-1", kind: "photo", mime: "image/jpeg", name: "IMG_4102.jpg", width: 1600, height: 1200, duration_s: null, taken_at: "2026-07-06T05:10:00Z", caption: null },
        { id: "m3", drive_file_id: "seed-kyabirwa-drill-2", kind: "photo", mime: "image/jpeg", name: "IMG_4117.jpg", width: 1200, height: 1600, duration_s: null, taken_at: "2026-07-06T11:55:00Z", caption: null },
        { id: "m4", drive_file_id: "seed-kyabirwa-drill-v1", kind: "video", mime: "video/mp4", name: "VID_4118.mp4", width: 1280, height: 720, duration_s: 42, taken_at: "2026-07-06T12:02:00Z", caption: null },
      ],
    },
    {
      id: "u1", stage: "survey", source: "admin", happened_at: "2026-06-24T07:00:00Z",
      body: "Survey team walked the site with the village committee today. The borehole will go beside the primary school so the children can drink before class.",
      media: [{ id: "m1", drive_file_id: "seed-kyabirwa-survey-1", kind: "photo", mime: "image/jpeg", name: "IMG_4021.jpg", width: 1600, height: 1200, duration_s: null, taken_at: "2026-06-24T06:40:00Z", caption: null }],
    },
  ],
  costs: [
    { category: "drilling", amount: "5200", currency: "AUD", note: null },
    { category: "pump", amount: "1650", currency: "AUD", note: null },
    { category: "apron_platform", amount: "900", currency: "AUD", note: null },
    { category: "training", amount: "650", currency: "AUD", note: null },
    { category: "transport", amount: "800", currency: "AUD", note: null },
    { category: "monitoring", amount: "600", currency: "AUD", note: null },
  ],
  waterTests: [
    { tested_at: "2026-07-14", ph: "6.9", turbidity_ntu: "1.2", e_coli_cfu: 0, fluoride_mgl: "0.4", arsenic_ugl: "1.0", passed: true, lab: "NWSC Jinja laboratory", note: null },
  ],
  funding: { amount: "6000", currency: "AUD", funded_at: "2026-06-02", is_primary: true },
  cofunders: 2,
};

const mtenje: WellPage = {
  well: {
    id: "20000000-0000-0000-0000-000000000005",
    code: "MW-2026-032",
    name: "Mtenje",
    country: "MW",
    region: "Salima District",
    village: "Mtenje",
    approx_lat: -13.781,
    approx_lng: 34.455,
    status: "funded",
    people_served: 610,
    depth_m: null,
    yield_lph: null,
    source_type: "Borehole with Afridev pump",
    dedication: null,
    summary: "Inland farming village, 45 minutes from the tarmac.",
    drive_folder_id: null,
    folder_is_public: true,
    target_cost: "8900",
    currency: "AUD",
    updated_at: "2026-08-18T00:00:00Z",
  },
  stages: [
    { stage: "funded", reached_at: "2026-08-18", expected_at: null, note: null },
    { stage: "survey", reached_at: null, expected_at: "2026-09-15", note: null },
  ],
  updates: [],
  costs: [],
  waterTests: [],
  funding: { amount: "8900", currency: "AUD", funded_at: "2026-08-18", is_primary: true },
  cofunders: 1,
};

export const fixtureWells: Record<string, WellPage> = { [kyabirwa.well.code]: kyabirwa, [mtenje.well.code]: mtenje };

export const fixtureMyWells: MyWellRow[] = Object.values(fixtureWells).map((p) => ({
  id: p.well.id,
  code: p.well.code,
  name: p.well.name,
  country: p.well.country,
  region: p.well.region,
  status: p.well.status,
  people_served: p.well.people_served,
  approx_lat: p.well.approx_lat,
  approx_lng: p.well.approx_lng,
  updated_at: p.well.updated_at,
  amount: p.funding?.amount ?? null,
  funded_currency: p.funding?.currency ?? "AUD",
  funded_at: p.funding?.funded_at ?? null,
  is_primary: true,
  last_update_at: p.updates[0]?.happened_at ?? null,
  cover_file_id: p.updates.flatMap((u) => u.media).find((m) => m.kind === "photo")?.drive_file_id ?? null,
}));
