import { createClient } from "./supabase/server";
import { fixtureMyWells, fixtureProfile, fixtureWells, fixturesEnabled } from "./fixtures";
import { type Cost, type Funding, type MyWellRow, type Partner, type Profile, type StageRow, type Testimonial, type Update, type WaterTest, type Well, WELL_COLUMNS } from "./types";

export async function getProfile(): Promise<Profile | null> {
  if (fixturesEnabled()) return fixtureProfile;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
  return (data as Profile) ?? null;
}

export async function getMyWells(): Promise<MyWellRow[]> {
  if (fixturesEnabled()) return fixtureMyWells;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_wells")
    .select("*")
    .order("last_update_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as MyWellRow[];
}

export type WellPage = {
  well: Well;
  stages: StageRow[];
  updates: Update[];
  costs: Cost[];
  waterTests: WaterTest[];
  funding: Funding | null;
  cofunders: number;
  partner: Partner | null;
  testimonials: Testimonial[];
};

export async function getWellPage(code: string): Promise<WellPage | null> {
  if (fixturesEnabled()) return fixtureWells[code] ?? null;
  const supabase = await createClient();
  const { data: wellRow } = await supabase.from("wells").select(WELL_COLUMNS).eq("code", code).maybeSingle();
  const well = wellRow as unknown as Well | null;
  if (!well) return null;

  const [stages, updates, costs, tests, funding, cofunders, partner, testimonials] = await Promise.all([
    supabase.from("stages").select("stage, reached_at, expected_at, note").eq("well_id", well.id),
    supabase
      .from("updates")
      .select("id, stage, body, happened_at, source, media(id, drive_file_id, kind, mime, name, width, height, duration_s, taken_at, caption, tag)")
      .eq("well_id", well.id)
      .order("happened_at", { ascending: false }),
    supabase.from("costs").select("category, amount, currency, note").eq("well_id", well.id),
    supabase.from("water_tests").select("*").eq("well_id", well.id).order("tested_at", { ascending: false }),
    supabase.from("well_funders").select("amount, currency, funded_at, is_primary").eq("well_id", well.id).maybeSingle(),
    supabase.rpc("cofunder_count", { w: well.id }),
    well.partner_org_id
      ? supabase.from("organizations").select("id, name, country, intro, contact_name, contact_title, website, logo_file_id").eq("id", well.partner_org_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("testimonials").select("id, name, age, role, quote, photo_file_id, sort").eq("well_id", well.id).order("sort").order("created_at"),
  ]);

  const sortedUpdates = ((updates.data ?? []) as Update[]).map((u) => ({
    ...u,
    media: [...u.media].sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? "")),
  }));

  return {
    well: well as Well,
    stages: (stages.data ?? []) as StageRow[],
    updates: sortedUpdates,
    costs: (costs.data ?? []) as Cost[],
    waterTests: (tests.data ?? []) as WaterTest[],
    funding: (funding.data as Funding | null) ?? null,
    cofunders: (cofunders.data as number | null) ?? 0,
    partner: (partner.data as Partner | null) ?? null,
    testimonials: (testimonials.data ?? []) as Testimonial[],
  };
}
