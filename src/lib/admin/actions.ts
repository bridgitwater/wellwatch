"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { createWellFolder } from "../drive/client";
import { STAGE_ORDER, type WellStage } from "../stages";
import { requireAdmin } from "./guard";
import { ensureFunderProfile } from "./funders";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const str = (max = 500) => z.string().trim().max(max);
const optStr = (max = 500) => str(max).transform((s) => (s === "" ? null : s)).nullable().optional();
const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nullable());
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().date().nullable());

function fields(fd: FormData) {
  return Object.fromEntries(fd.entries());
}

function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, error: msg };
}

// ---------------------------------------------------------------------------
// Wells
// ---------------------------------------------------------------------------
const wellSchema = z.object({
  code: str(20).regex(/^[A-Z]{2}-\d{4}-\d{3}$/, "Code must look like UG-2026-014"),
  name: str(120).min(1, "Name is required"),
  country: str(2).length(2, "Two-letter country code").transform((s) => s.toUpperCase()),
  region: optStr(120),
  village: optStr(120),
  approx_lat: optNum,
  approx_lng: optNum,
  exact_lat: optNum,
  exact_lng: optNum,
  people_served: optNum,
  depth_m: optNum,
  yield_lph: optNum,
  source_type: optStr(120),
  dedication: optStr(300),
  summary: optStr(1000),
  partner_org_id: optStr(40),
  target_cost: optNum,
  currency: str(3).default("AUD").transform((s) => s.toUpperCase()),
  folder_is_public: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function createWell(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = wellSchema.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();

  const { data, error } = await supabase.from("wells").insert(parsed.data).select("id, code, name").single();
  if (error) return fail(error.code === "23505" ? new Error("A well with that code already exists") : error);

  // First stage: funded today.
  await supabase.from("stages").insert({ well_id: data.id, stage: "funded", reached_at: new Date().toISOString().slice(0, 10) });

  // Drive folder, if Drive is configured. Failure here shouldn't block the well.
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 && process.env.DRIVE_SHARED_DRIVE_ID) {
    try {
      const folderId = await createWellFolder(data.code, data.name, parsed.data.folder_is_public);
      await supabase.from("wells").update({ drive_folder_id: folderId }).eq("id", data.id);
    } catch (e) {
      console.error("Drive folder creation failed", e);
    }
  }

  revalidatePath("/admin/wells");
  redirect(`/admin/wells/${data.code}`);
}

export async function updateWell(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = wellSchema.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("wells").update(parsed.data).eq("id", id);
  if (error) return fail(error);
  revalidatePath(`/admin/wells/${parsed.data.code}`);
  revalidatePath(`/wells/${parsed.data.code}`);
  return { ok: true, message: "Saved" };
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------
export async function setStage(fd: FormData): Promise<void> {
  await requireAdmin();
  const well_id = String(fd.get("well_id"));
  const code = String(fd.get("code"));
  const stage = String(fd.get("stage")) as WellStage;
  if (!STAGE_ORDER.includes(stage)) return;
  const reached_at = (fd.get("reached_at") as string) || null;
  const expected_at = (fd.get("expected_at") as string) || null;
  const note = ((fd.get("note") as string) || "").trim() || null;
  const supabase = await createClient();
  await supabase.from("stages").upsert({ well_id, stage, reached_at, expected_at, note }, { onConflict: "well_id,stage" });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
}

// ---------------------------------------------------------------------------
// Funders
// ---------------------------------------------------------------------------
const funderSchema = z.object({
  well_id: str(40),
  code: str(20),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  display_name: optStr(120),
  amount: optNum,
  currency: str(3).default("AUD").transform((s) => s.toUpperCase()),
  funded_at: optDate,
  is_primary: z.preprocess((v) => v === "on", z.boolean()),
});

/** Links a funder (creating their account if needed) to a well. */
export async function addFunder(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = funderSchema.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { well_id, code, email, display_name, amount, currency, funded_at, is_primary } = parsed.data;

  try {
    const profileId = await ensureFunderProfile(email, display_name ?? null);
    const supabase = await createClient();
    const { error } = await supabase
      .from("well_funders")
      .upsert({ well_id, profile_id: profileId, amount, currency, funded_at, is_primary }, { onConflict: "well_id,profile_id" });
    if (error) throw error;
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/wells/${code}`);
  return { ok: true, message: `${email} linked` };
}

export async function removeFunder(fd: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("well_funders").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
}

// ---------------------------------------------------------------------------
// Updates & media
// ---------------------------------------------------------------------------
export async function saveUpdate(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const code = String(fd.get("code"));
  const body = ((fd.get("body") as string) || "").trim() || null;
  const stage = (fd.get("stage") as WellStage) || null;
  const status = fd.get("status") === "hidden" ? "hidden" : "published";
  const supabase = await createClient();
  await supabase.from("updates").update({ body, stage, status }).eq("id", id);
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
  revalidatePath("/admin");
}

export async function toggleUpdateHidden(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const hide = fd.get("hide") === "1";
  const supabase = await createClient();
  await supabase.from("updates").update({ status: hide ? "hidden" : "published" }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
}

export async function toggleMediaHidden(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const hide = fd.get("hide") === "1";
  const supabase = await createClient();
  await supabase.from("media").update({ hidden: hide }).eq("id", id);
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
}

export async function createNote(fd: FormData): Promise<void> {
  const profile = await requireAdmin();
  const well_id = String(fd.get("well_id"));
  const code = String(fd.get("code"));
  const body = ((fd.get("body") as string) || "").trim();
  if (!body) return;
  const stage = (fd.get("stage") as WellStage) || null;
  const supabase = await createClient();
  await supabase.from("updates").insert({ well_id, author_id: profile.id, source: "admin", stage, body });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
}

// ---------------------------------------------------------------------------
// Costs & water tests
// ---------------------------------------------------------------------------
export async function addCost(fd: FormData): Promise<void> {
  await requireAdmin();
  const code = String(fd.get("code"));
  const amount = Number(fd.get("amount"));
  if (!Number.isFinite(amount)) return;
  const supabase = await createClient();
  await supabase.from("costs").insert({
    well_id: String(fd.get("well_id")),
    category: String(fd.get("category")),
    amount,
    currency: String(fd.get("currency") || "AUD").toUpperCase(),
    note: ((fd.get("note") as string) || "").trim() || null,
  });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
}

export async function deleteCost(fd: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("costs").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
}

export async function addWaterTest(fd: FormData): Promise<void> {
  await requireAdmin();
  const code = String(fd.get("code"));
  const num = (k: string) => {
    const v = fd.get(k);
    return v === null || v === "" ? null : Number(v);
  };
  const supabase = await createClient();
  await supabase.from("water_tests").insert({
    well_id: String(fd.get("well_id")),
    tested_at: String(fd.get("tested_at")),
    ph: num("ph"),
    turbidity_ntu: num("turbidity_ntu"),
    e_coli_cfu: num("e_coli_cfu"),
    fluoride_mgl: num("fluoride_mgl"),
    arsenic_ugl: num("arsenic_ugl"),
    passed: fd.get("passed") === "on",
    lab: ((fd.get("lab") as string) || "").trim() || null,
    note: ((fd.get("note") as string) || "").trim() || null,
  });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
export async function createOrganization(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = ((fd.get("name") as string) || "").trim();
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("organizations").insert({
    name,
    country: ((fd.get("country") as string) || "").trim().toUpperCase() || null,
    type: "partner",
  });
  revalidatePath("/admin/partners");
}
