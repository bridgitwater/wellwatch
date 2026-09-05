"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { STAGE_ORDER, type WellStage } from "../stages";
import type { ActionResult } from "./actions";
import { ensureFunderProfile } from "./funders";
import { parseCsv } from "./csv";
import { requireAdmin } from "./guard";

export type ImportResult = ActionResult & { imported?: number; skipped?: string[] };

const num = (v: string) => (v === "" ? null : Number(v));

export async function importWellsCsv(_prev: ImportResult | null, fd: FormData): Promise<ImportResult> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  const rows = parseCsv(await file.text());
  if (rows.length === 0) return { ok: false, error: "No rows found" };
  if (!("code" in rows[0]) || !("name" in rows[0])) return { ok: false, error: "CSV needs at least code and name columns" };

  const supabase = await createClient();
  const { data: orgs } = await supabase.from("organizations").select("id, name");
  const orgByName = new Map((orgs ?? []).map((o) => [o.name.toLowerCase(), o.id]));

  let imported = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const code = r.code.toUpperCase();
    if (!/^[A-Z]{2}-\d{4}-\d{3}$/.test(code)) { skipped.push(`${r.code}: bad code`); continue; }
    const partner = r.partner ? orgByName.get(r.partner.toLowerCase()) : null;
    if (r.partner && !partner) { skipped.push(`${code}: unknown partner "${r.partner}"`); continue; }

    const { data, error } = await supabase
      .from("wells")
      .upsert(
        {
          code,
          name: r.name,
          country: (r.country || code.slice(0, 2)).toUpperCase(),
          region: r.region || null,
          village: r.village || null,
          approx_lat: num(r.approx_lat ?? ""),
          approx_lng: num(r.approx_lng ?? ""),
          people_served: num(r.people_served ?? ""),
          partner_org_id: partner ?? null,
          target_cost: num(r.target_cost ?? ""),
          currency: (r.currency || "AUD").toUpperCase(),
          dedication: r.dedication || null,
          summary: r.summary || null,
        },
        { onConflict: "code" },
      )
      .select("id")
      .single();
    if (error || !data) { skipped.push(`${code}: ${error?.message}`); continue; }

    // Optional status column: mark every stage up to it as reached (date unknown → today).
    const status = (r.status || "funded") as WellStage;
    if (STAGE_ORDER.includes(status)) {
      const idx = STAGE_ORDER.indexOf(status);
      const today = new Date().toISOString().slice(0, 10);
      const stageRows = STAGE_ORDER.slice(0, idx + 1).map((s) => ({ well_id: data.id, stage: s, reached_at: today }));
      await supabase.from("stages").upsert(stageRows, { onConflict: "well_id,stage", ignoreDuplicates: true });
    }
    imported++;
  }
  revalidatePath("/admin/wells");
  return { ok: true, imported, skipped, message: `${imported} wells imported${skipped.length ? `, ${skipped.length} skipped` : ""}` };
}

export async function importFundersCsv(_prev: ImportResult | null, fd: FormData): Promise<ImportResult> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  const rows = parseCsv(await file.text());
  if (rows.length === 0) return { ok: false, error: "No rows found" };
  if (!("well_code" in rows[0]) || !("email" in rows[0])) return { ok: false, error: "CSV needs well_code and email columns" };

  const supabase = await createClient();
  const { data: wells } = await supabase.from("wells").select("id, code");
  const wellByCode = new Map((wells ?? []).map((w) => [w.code, w.id]));

  let imported = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const wellId = wellByCode.get(r.well_code.toUpperCase());
    const email = r.email.toLowerCase();
    if (!wellId) { skipped.push(`${email}: no well ${r.well_code}`); continue; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped.push(`${r.email}: bad email`); continue; }
    try {
      const profileId = await ensureFunderProfile(email, r.display_name || null);
      const { error } = await supabase.from("well_funders").upsert(
        {
          well_id: wellId,
          profile_id: profileId,
          amount: num(r.amount ?? ""),
          currency: (r.currency || "AUD").toUpperCase(),
          funded_at: r.funded_at || null,
          is_primary: /^(1|true|yes|y)$/i.test(r.is_primary ?? ""),
        },
        { onConflict: "well_id,profile_id" },
      );
      if (error) throw error;
      imported++;
    } catch (e) {
      skipped.push(`${email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  revalidatePath("/admin/wells");
  return { ok: true, imported, skipped, message: `${imported} funder links imported${skipped.length ? `, ${skipped.length} skipped` : ""}` };
}
