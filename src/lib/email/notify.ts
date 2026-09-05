import "server-only";
import { errorMessage } from "@/lib/supabase/admin";
import { createAdminClient } from "../supabase/admin";
import { STAGE_LABEL, type WellStage } from "../stages";
import { fmtDate } from "../format";
import { APP_URL, esc, layout, sendEmail } from "./send";

export type NotifyResult = { funderEmails: number; digestEmails: number; errors: string[] };

/**
 * Sends the emails that are due:
 *  - to funders: one email per well per day, covering every published update whose 2-hour hold has passed
 *  - to admins: a daily digest of everything posted in the last 24h (once per day, after 17:00 UTC ≈ next morning in Fiji/AEST)
 */
export async function runNotifications(): Promise<NotifyResult> {
  const db = createAdminClient();
  const result: NotifyResult = { funderEmails: 0, digestEmails: 0, errors: [] };
  const now = new Date();

  // ---- Funder notices -------------------------------------------------------
  const due = await db
    .from("updates")
    .select("id, well_id, body, stage, happened_at, wells(code, name), media(kind, hidden)")
    .eq("status", "published")
    .is("notified_at", null)
    .lte("notify_after", now.toISOString())
    .order("happened_at");
  if (due.error) throw due.error;

  type DueRow = { id: string; well_id: string; body: string | null; stage: WellStage | null; happened_at: string; wells: { code: string; name: string } | null; media: { kind: string; hidden: boolean }[] };
  const byWell = new Map<string, DueRow[]>();
  for (const u of (due.data ?? []) as unknown as DueRow[]) byWell.set(u.well_id, [...(byWell.get(u.well_id) ?? []), u]);

  for (const [wellId, updates] of byWell) {
    const well = updates[0].wells;
    if (!well) continue;

    const funders = await db
      .from("well_funders")
      .select("profile_id, profiles(email, display_name, notify_email)")
      .eq("well_id", wellId);
    type FRow = { profile_id: string; profiles: { email: string; display_name: string | null; notify_email: boolean } | null };

    // At most one email per funder per well per day.
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const recent = await db.from("notifications").select("profile_id").eq("well_id", wellId).eq("kind", "new_update").gte("sent_at", dayAgo);
    const alreadyToday = new Set((recent.data ?? []).map((r) => r.profile_id));

    const photos = updates.reduce((n, u) => n + u.media.filter((m) => m.kind === "photo" && !m.hidden).length, 0);
    const videos = updates.reduce((n, u) => n + u.media.filter((m) => m.kind === "video" && !m.hidden).length, 0);
    const notes = updates.filter((u) => u.body).map((u) => `<p style="margin:0 0 10px"><strong>${fmtDate(u.happened_at)}${u.stage ? ` · ${STAGE_LABEL[u.stage]}` : ""}</strong><br>${esc(u.body!)}</p>`).join("");
    const what = [photos && `${photos} new photo${photos === 1 ? "" : "s"}`, videos && `${videos} new video${videos === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
    const href = `${APP_URL}/wells/${well.code}`;
    const subject = `New from ${well.name}${what ? `: ${what}` : ""}`;
    const html = layout(`News from ${well.name}`, `${what ? `<p style="margin:0 0 12px">The team has posted ${what} from your well.</p>` : ""}${notes}`, href, "See the update");
    const text = `News from ${well.name}\n\n${what ? `The team has posted ${what}.\n\n` : ""}${updates.filter((u) => u.body).map((u) => `${fmtDate(u.happened_at)}: ${u.body}`).join("\n\n")}\n\n${href}`;

    for (const f of (funders.data ?? []) as unknown as FRow[]) {
      if (!f.profiles?.notify_email || alreadyToday.has(f.profile_id)) continue;
      try {
        await sendEmail(f.profiles.email, subject, html, text);
        await db.from("notifications").insert({ profile_id: f.profile_id, well_id: wellId, kind: "new_update", meta: { updates: updates.map((u) => u.id) } });
        result.funderEmails++;
      } catch (e) {
        result.errors.push(`${f.profiles.email}: ${errorMessage(e)}`);
      }
    }
    await db.from("updates").update({ notified_at: now.toISOString() }).in("id", updates.map((u) => u.id));
  }

  // ---- Admin digest ----------------------------------------------------------
  // Fiji is UTC+12 and eastern Australia UTC+10; 20:00 UTC lands 6–8am locally.
  if (now.getUTCHours() >= 20) {
    const admins = await db.from("profiles").select("id, email").eq("role", "admin").eq("notify_email", true);
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    for (const a of admins.data ?? []) {
      const sentToday = await db.from("notifications").select("id").eq("profile_id", a.id).eq("kind", "digest").gte("sent_at", dayAgo).limit(1);
      if ((sentToday.data ?? []).length) continue;

      const posted = await db
        .from("updates")
        .select("id, body, source, created_at, wells(code, name), media(kind)")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false });
      type PRow = { id: string; body: string | null; source: string; created_at: string; wells: { code: string; name: string } | null; media: { kind: string }[] };
      const rows = (posted.data ?? []) as unknown as PRow[];
      if (rows.length === 0) continue;

      const items = rows.map((r) => `<li><a href="${APP_URL}/admin/wells/${r.wells?.code}" style="color:#17607d;font-weight:600">${esc(r.wells?.name ?? "")}</a> <span style="color:#8a9ba3">${r.wells?.code} · ${r.media.length} file${r.media.length === 1 ? "" : "s"} · ${r.source}</span>${r.body ? `<br><span style="color:#51666f">${esc(r.body)}</span>` : ""}</li>`).join("");
      const html = layout(`${rows.length} update${rows.length === 1 ? "" : "s"} posted yesterday`, `<ul style="padding-left:18px;margin:0">${items}</ul>`, `${APP_URL}/admin`, "Open admin");
      try {
        await sendEmail(a.email, `WellWatch digest: ${rows.length} update${rows.length === 1 ? "" : "s"}`, html, rows.map((r) => `${r.wells?.name} (${r.wells?.code}): ${r.media.length} files${r.body ? ` — ${r.body}` : ""}`).join("\n"));
        await db.from("notifications").insert({ profile_id: a.id, kind: "digest", meta: { count: rows.length } });
        result.digestEmails++;
      } catch (e) {
        result.errors.push(`digest ${a.email}: ${errorMessage(e)}`);
      }
    }
  }

  return result;
}
