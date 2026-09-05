import { createClient } from "./supabase/server";
import type { Cost, Funding, MyWellRow, Profile, StageRow, Update, WaterTest, Well } from "./types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
  return (data as Profile) ?? null;
}

export async function getMyWells(): Promise<MyWellRow[]> {
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
};

export async function getWellPage(code: string): Promise<WellPage | null> {
  const supabase = await createClient();
  const { data: well } = await supabase.from("wells").select("*").eq("code", code).maybeSingle();
  if (!well) return null;

  const [stages, updates, costs, tests, funding, cofunders] = await Promise.all([
    supabase.from("stages").select("stage, reached_at, expected_at, note").eq("well_id", well.id),
    supabase
      .from("updates")
      .select("id, stage, body, happened_at, source, media(id, drive_file_id, kind, mime, name, width, height, duration_s, taken_at, caption)")
      .eq("well_id", well.id)
      .order("happened_at", { ascending: false }),
    supabase.from("costs").select("category, amount, currency, note").eq("well_id", well.id),
    supabase.from("water_tests").select("*").eq("well_id", well.id).order("tested_at", { ascending: false }),
    supabase.from("well_funders").select("amount, currency, funded_at, is_primary").eq("well_id", well.id).maybeSingle(),
    supabase.rpc("cofunder_count", { w: well.id }),
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
  };
}
