"use server";
import { errorMessage } from "@/lib/supabase/admin";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { createWellFolder } from "../drive/client";
import { STAGE_ORDER, type WellStage } from "../stages";
import { requireAdmin } from "./guard";
import { ensureFunderProfile } from "./funders";
import { emailSchema } from "../email-address";
import { sendFunderWelcome, sendWelcomes } from "../email/welcome";
import { applyShares, driveConfigured, makeFoldersPrivate } from "../drive/shares";
import { listAllInDrive, sharedDriveId } from "../drive/client";
import { createAdminClient } from "../supabase/admin";
import { countryTimeZone, exifLocalToIso, tzOffsetMinutes } from "../timezones";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const str = (max = 500) => z.string().trim().max(max);
const optStr = (max = 500) => str(max).transform((s) => (s === "" ? null : s)).nullable().optional();
const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nullable());
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().date().nullable());

/**
 * After hiding or showing photos (or setting a report, testimonial photo or logo), update
 * Drive links straight away instead of waiting for the 10-minute sync. Best effort: the
 * sync retries anything that fails. Returns a note for the admin when it isn't done yet.
 */
async function applySharingNow(fileIds: (string | null | undefined)[]): Promise<string | null> {
  const ids = fileIds.filter((x): x is string => !!x);
  if (!ids.length || !driveConfigured()) return null;
  try {
    return await applyShares(createAdminClient(), ids);
  } catch {
    return "Saved. Drive hasn't caught up yet; WellWatch will retry within 10 minutes.";
  }
}

async function fileIdsOfUpdate(updateId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("media").select("drive_file_id").eq("update_id", updateId);
  return (data ?? []).map((m) => m.drive_file_id);
}

function fields(fd: FormData) {
  return Object.fromEntries(fd.entries());
}

function fail(e: unknown): ActionResult {
  const msg = errorMessage(e);
  return { ok: false, error: msg };
}

/** Turns a Supabase write result into what the admin sees next to the button. */
function result(error: unknown, message?: string): ActionResult {
  return error ? fail(error) : { ok: true, message };
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
  showcase: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  // Completion-report fields
  well_type: z.enum(["drilled", "hand_drilled", "refurbished", "solar_system", "piped_scheme", "other"]).default("drilled"),
  program_name: optStr(200),
  sponsor_line: optStr(200),
  households: optNum,
  pump_type: optStr(120),
  contractor: optStr(160),
  gps_text: optStr(120),
  before_story: optStr(4000),
  before_distance_km: optNum,
  after_distance_m: optNum,
  hours_saved_day: optNum,
  impacts: optStr(4000),
  wuc_members: optNum,
  wuc_women: optNum,
  wuc_youth: optNum,
  wuc_pwd: optNum,
  wuc_treasurer_woman: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  training_note: optStr(4000),
  sustainability: optStr(4000),
  challenges: optStr(4000),
  lessons: optStr(4000),
  plaque_installed: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  completed_at: optDate,
  report_file_id: optStr(120).transform((v) => (v ? driveIdFrom(v) : v)),
});

/** Accepts a Drive file id or any Drive URL and returns the id. */
function driveIdFrom(v: string): string {
  const m = v.match(/\/d\/([\w-]{20,})/) ?? v.match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : v;
}

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
      const folderId = await createWellFolder(data.code, data.name);
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
  const note = await applySharingNow([parsed.data.report_file_id]);
  return { ok: true, message: note ?? "Saved" };
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------
export async function setStage(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const well_id = String(fd.get("well_id"));
  const code = String(fd.get("code"));
  const stage = String(fd.get("stage")) as WellStage;
  if (!STAGE_ORDER.includes(stage)) return { ok: false, error: "Unknown stage" };
  const reached_at = (fd.get("reached_at") as string) || null;
  const expected_at = (fd.get("expected_at") as string) || null;
  const note = ((fd.get("note") as string) || "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("stages").upsert({ well_id, stage, reached_at, expected_at, note }, { onConflict: "well_id,stage" });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
  return result(error, "Saved");
}

// ---------------------------------------------------------------------------
// Funders
// ---------------------------------------------------------------------------
const funderSchema = z.object({
  well_id: str(40),
  code: str(20),
  email: emailSchema,
  display_name: optStr(120),
  amount: optNum,
  currency: str(3).default("AUD").transform((s) => s.toUpperCase()),
  funded_at: optDate,
  is_primary: z.preprocess((v) => v === "on", z.boolean()),
  send_welcome: z.preprocess((v) => v === "on", z.boolean()),
});

/** Links a funder (creating their account if needed) to a well. */
export async function addFunder(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = funderSchema.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { well_id, code, email, display_name, amount, currency, funded_at, is_primary, send_welcome } = parsed.data;

  let linkId: string;
  try {
    const profileId = await ensureFunderProfile(email, display_name ?? null);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("well_funders")
      .upsert({ well_id, profile_id: profileId, amount, currency, funded_at, is_primary }, { onConflict: "well_id,profile_id" })
      .select("id")
      .single();
    if (error) throw error;
    linkId = data.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/admin/wells/${code}`);
  if (!send_welcome) return { ok: true, message: `${email} linked. No emails go to them until you send their welcome.` };
  try {
    await sendFunderWelcome(linkId);
    revalidatePath(`/admin/wells/${code}`);
    return { ok: true, message: `${email} linked and welcomed` };
  } catch (e) {
    return { ok: false, error: `${email} linked, but the welcome email failed: ${errorMessage(e)}` };
  }
}

export async function removeFunder(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("well_funders").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  return result(error);
}

/** Sends a funder their welcome email for this well; from then on they get update emails. */
export async function sendWelcome(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const email = await sendFunderWelcome(String(fd.get("id")));
    revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
    return { ok: true, message: `Welcome sent to ${email}` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Updates & media
// ---------------------------------------------------------------------------
export async function saveUpdate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const code = String(fd.get("code"));
  const body = ((fd.get("body") as string) || "").trim() || null;
  const stage = (fd.get("stage") as WellStage) || null;
  const status = fd.get("status") === "hidden" ? "hidden" : "published";
  const happenedOn = String(fd.get("happened_on") ?? "").trim(); // YYYY-MM-DD in the well's local zone, or ""
  const supabase = await createClient();

  const patch: { body: string | null; stage: WellStage | null; status: string; happened_at?: string } = { body, stage, status };
  if (/^\d{4}-\d{2}-\d{2}$/.test(happenedOn)) {
    // Change the calendar day but keep the time of day, both in the well's local zone.
    const { data: cur } = await supabase.from("updates").select("happened_at, wells(country)").eq("id", id).maybeSingle();
    const row = cur as unknown as { happened_at: string; wells: { country: string } | null } | null;
    if (row) {
      const zone = countryTimeZone(row.wells?.country);
      const at = new Date(row.happened_at);
      const local = new Date(at.getTime() + tzOffsetMinutes(zone, at) * 60000);
      const hms = local.toISOString().slice(11, 19);
      const iso = exifLocalToIso(`${happenedOn.replaceAll("-", ":")} ${hms}`, zone);
      if (iso && iso !== row.happened_at) patch.happened_at = iso;
    }
  }
  const { error } = await supabase.from("updates").update(patch).eq("id", id);
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
  revalidatePath("/admin");
  if (error) return result(error);
  const note = await applySharingNow(await fileIdsOfUpdate(id));
  return note ? { ok: true, message: note } : result(null, "Saved");
}

export async function toggleUpdateHidden(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const hide = fd.get("hide") === "1";
  const supabase = await createClient();
  const { error } = await supabase.from("updates").update({ status: hide ? "hidden" : "published" }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
  if (error) return result(error);
  const note = await applySharingNow(await fileIdsOfUpdate(id));
  return note ? { ok: true, message: note } : result(null);
}

export async function toggleMediaHidden(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const hide = fd.get("hide") === "1";
  const supabase = await createClient();
  const { data: m, error } = await supabase.from("media").update({ hidden: hide }).eq("id", id).select("drive_file_id").maybeSingle();
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
  if (error) return result(error);
  const note = await applySharingNow(m ? [m.drive_file_id] : []);
  return note ? { ok: true, message: note } : result(null);
}

export async function setMediaTag(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const tag = ((fd.get("tag") as string) || "").trim() || null;
  const caption = ((fd.get("caption") as string) || "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("media").update({ tag, caption }).eq("id", id);
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
  return result(error, "Saved");
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
const testimonialSchema = z.object({
  well_id: str(40),
  code: str(20),
  name: str(120).min(1, "Name is required"),
  age: optNum,
  role: optStr(160),
  quote: str(3000).min(1, "Quote is required"),
  photo_file_id: optStr(200).transform((v) => (v ? driveIdFrom(v) : v)),
});

export async function addTestimonial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = testimonialSchema.safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { code, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").insert(row);
  if (error) return fail(error);
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
  const note = await applySharingNow([row.photo_file_id]);
  return { ok: true, message: note ?? "Added" };
}

export async function deleteTestimonial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
  return result(error);
}

export async function createNote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();
  const well_id = String(fd.get("well_id"));
  const code = String(fd.get("code"));
  const body = ((fd.get("body") as string) || "").trim();
  if (!body) return { ok: false, error: "Write something first" };
  const stage = (fd.get("stage") as WellStage) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("updates").insert({ well_id, author_id: profile.id, source: "admin", stage, body });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
  return result(error, "Posted");
}

// ---------------------------------------------------------------------------
// Costs & water tests
// ---------------------------------------------------------------------------
export async function addCost(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const code = String(fd.get("code"));
  const amount = Number(fd.get("amount"));
  if (!Number.isFinite(amount)) return { ok: false, error: "Enter an amount" };
  const supabase = await createClient();
  const { error } = await supabase.from("costs").insert({
    well_id: String(fd.get("well_id")),
    category: String(fd.get("category")),
    amount,
    currency: String(fd.get("currency") || "AUD").toUpperCase(),
    note: ((fd.get("note") as string) || "").trim() || null,
  });
  revalidatePath(`/admin/wells/${code}`);
  revalidatePath(`/wells/${code}`);
  return result(error, "Added");
}

export async function deleteCost(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("costs").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/admin/wells/${String(fd.get("code"))}`);
  revalidatePath(`/wells/${String(fd.get("code"))}`);
  return result(error);
}

export async function addWaterTest(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const code = String(fd.get("code"));
  const num = (k: string) => {
    const v = fd.get(k);
    return v === null || v === "" ? null : Number(v);
  };
  const supabase = await createClient();
  const { error } = await supabase.from("water_tests").insert({
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
  return result(error, "Added");
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
export async function createOrganization(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = ((fd.get("name") as string) || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").insert({
    name,
    country: ((fd.get("country") as string) || "").trim().toUpperCase() || null,
    type: "partner",
  });
  revalidatePath("/admin/partners");
  return result(error, "Added");
}

export async function updateOrganization(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      id: str(40),
      name: str(160).min(1, "Name is required"),
      country: optStr(2).transform((v) => v?.toUpperCase() ?? null),
      intro: optStr(2000),
      contact_name: optStr(120),
      contact_title: optStr(120),
      website: optStr(200),
      logo_file_id: optStr(200).transform((v) => (v ? driveIdFrom(v) : v)),
    })
    .safeParse(fields(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update(row).eq("id", id);
  if (error) return fail(error);
  revalidatePath("/admin/partners");
  const note = await applySharingNow([row.logo_file_id]);
  return { ok: true, message: note ?? "Saved" };
}

// ---------------------------------------------------------------------------
// Bulk welcomes
// ---------------------------------------------------------------------------
const BULK_LIMIT = 25;

/**
 * Welcomes the chosen funders: one email each, covering every well of theirs that
 * hasn't been welcomed yet. At most 25 funders a go, sent one at a time.
 */
export async function sendBulkWelcomes(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const funders = [...new Set(fd.getAll("funder").map(String))].filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (!funders.length) return { ok: false, error: "Tick at least one funder." };
  if (funders.length > BULK_LIMIT) return { ok: false, error: `That's ${funders.length} funders. Send at most ${BULK_LIMIT} at a time.` };

  const db = createAdminClient();
  const { data: links, error } = await db.from("well_funders").select("id").in("profile_id", funders).is("welcomed_at", null);
  if (error) return fail(error);
  if (!links?.length) return { ok: false, error: "Those funders have all been welcomed already." };

  const results = await sendWelcomes(links.map((l) => l.id));
  revalidatePath("/admin/welcomes");
  revalidatePath("/admin/wells", "layout");
  const sent = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const summary = `Sent ${sent.length} welcome email${sent.length === 1 ? "" : "s"} (${sent.reduce((n, r) => n + r.wells, 0)} wells).`;
  if (!failed.length) return { ok: true, message: summary };
  return { ok: false, error: `${summary} Not sent: ${failed.map((f) => `${f.email} (${f.error})`).join("; ")}` };
}

// ---------------------------------------------------------------------------
// Drive privacy
// ---------------------------------------------------------------------------
/** Phase 2 of private folders: see makeFoldersPrivate in src/lib/drive/shares.ts. */
export async function makeDriveFoldersPrivate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!driveConfigured()) return { ok: false, error: "Drive isn't connected on this server." };
  // "Try one folder first" sends max=1, so the result can be checked before doing the rest.
  const max = fd.get("max") === "1" ? 1 : Infinity;
  try {
    const r = await makeFoldersPrivate(createAdminClient(), await listAllInDrive(), sharedDriveId(), undefined, undefined, max);
    if (max === 1 && r.madePrivate.length) {
      revalidatePath("/admin");
      return { ok: true, message: `Made "${r.madePrivate[0]}" private. Check its well page still shows its photos, then make the rest private.` };
    }
    revalidatePath("/admin");
    const parts = [
      r.madePrivate.length ? `${r.madePrivate.length} folder${r.madePrivate.length === 1 ? "" : "s"} made private.` : "No folders changed.",
      r.skipped.length ? `Waiting: ${r.skipped.join("; ")}.` : "",
      r.errors.length ? `Problems: ${r.errors.join("; ")}.` : "",
    ].filter(Boolean).join(" ");
    return r.errors.length ? { ok: false, error: parts } : { ok: true, message: parts };
  } catch (e) {
    return fail(e);
  }
}
