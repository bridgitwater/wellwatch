import "server-only";
import { errorMessage } from "@/lib/supabase/admin";
import { createAdminClient } from "../supabase/admin";
import { stageLabel, type WellStage } from "../stages";
import { fmtDateIn } from "../format";
import type { WellType } from "../types";
import { APP_URL, esc, layout, sendEmail } from "./send";

/** How each logged sign-in miss reads to an admin. */
export const SIGNIN_OUTCOME: Record<string, string> = {
  not_on_file: "email not on file",
  rate_limited: "too many requests",
  error: "sending failed",
};

export type NotifyResult = { funderEmails: number; digestEmails: number; errors: string[] };

/**
 * Sends the emails that are due:
 *  - to funders: one email per well per day, covering every published update whose 2-hour hold has passed
 *  - to admins: a daily digest of everything posted in the last 24h (once per day, after 20:00 UTC ≈ 6–8am in Fiji/AEST)
 *
 * An update is marked notified once every due email for its well was sent; if any send (or the
 * funder lookup) fails the update stays due and is retried next hour (the per-funder-per-day
 * guard stops duplicates). Funders who haven't been sent their welcome email are skipped, so
 * they never hear about updates posted before their welcome; the welcome links to the well.
 */
export async function runNotifications(): Promise<NotifyResult> {
  const db = createAdminClient();
  const result: NotifyResult = { funderEmails: 0, digestEmails: 0, errors: [] };
  const now = new Date();

  // ---- Funder notices -------------------------------------------------------
  const due = await db
    .from("updates")
    .select("id, well_id, body, stage, happened_at, wells(code, name, country, well_type), media(kind, hidden)")
    .eq("status", "published")
    .is("notified_at", null)
    .lte("notify_after", now.toISOString())
    .order("happened_at");
  if (due.error) throw due.error;

  type DueRow = { id: string; well_id: string; body: string | null; stage: WellStage | null; happened_at: string; wells: { code: string; name: string; country: string; well_type: WellType } | null; media: { kind: string; hidden: boolean }[] };
  const byWell = new Map<string, DueRow[]>();
  for (const u of (due.data ?? []) as unknown as DueRow[]) byWell.set(u.well_id, [...(byWell.get(u.well_id) ?? []), u]);

  for (const [wellId, updates] of byWell) {
    const well = updates[0].wells;
    if (!well) continue;

    const funders = await db
      .from("well_funders")
      .select("profile_id, welcomed_at, profiles(email, display_name, notify_email)")
      .eq("well_id", wellId);
    type FRow = { profile_id: string; welcomed_at: string | null; profiles: { email: string; display_name: string | null; notify_email: boolean } | null };

    // At most one email per funder per well per day.
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const recent = await db.from("notifications").select("profile_id").eq("well_id", wellId).eq("kind", "new_update").gte("sent_at", dayAgo);
    // A failed lookup must not look like "no funders": that would mark these updates notified unsent.
    if (funders.error || recent.error) {
      result.errors.push(`funders (${well.code}): ${errorMessage(funders.error ?? recent.error)}`);
      continue;
    }
    const alreadyToday = new Set((recent.data ?? []).map((r) => r.profile_id));

    const photos = updates.reduce((n, u) => n + u.media.filter((m) => m.kind === "photo" && !m.hidden).length, 0);
    const videos = updates.reduce((n, u) => n + u.media.filter((m) => m.kind === "video" && !m.hidden).length, 0);
    const notes = updates.filter((u) => u.body).map((u) => `<p style="margin:0 0 10px"><strong>${fmtDateIn(well.country, u.happened_at)}${u.stage ? ` · ${stageLabel(u.stage, well.well_type)}` : ""}</strong><br>${esc(u.body!)}</p>`).join("");
    const what = [photos && `${photos} new photo${photos === 1 ? "" : "s"}`, videos && `${videos} new video${videos === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
    const href = `${APP_URL}/wells/${well.code}`;
    const subject = `New from ${well.name}${what ? `: ${what}` : ""}`;
    const html = layout(`News from ${well.name}`, `${what ? `<p style="margin:0 0 12px">The team has posted ${what} from your well.</p>` : ""}${notes}`, href, "See the update");
    const text = `News from ${well.name}\n\n${what ? `The team has posted ${what}.\n\n` : ""}${updates.filter((u) => u.body).map((u) => `${fmtDateIn(well.country, u.happened_at)}: ${u.body}`).join("\n\n")}\n\n${href}`;

    let failed = 0;
    for (const f of (funders.data ?? []) as unknown as FRow[]) {
      // Funders hear nothing until an admin has sent their welcome email for this well.
      if (!f.welcomed_at || !f.profiles?.notify_email || alreadyToday.has(f.profile_id)) continue;
      try {
        await sendEmail(f.profiles.email, subject, html, text);
        const logged = await db.from("notifications").insert({ profile_id: f.profile_id, well_id: wellId, kind: "new_update", meta: { updates: updates.map((u) => u.id) } });
        // Sent but not recorded: the per-day guard won't see it, so flag it rather than stay silent.
        if (logged.error) result.errors.push(`record notice ${f.profiles.email}: ${errorMessage(logged.error)}`);
        result.funderEmails++;
      } catch (e) {
        failed++;
        result.errors.push(`${f.profiles.email}: ${errorMessage(e)}`);
      }
    }
    // Only close the loop when nothing failed; otherwise leave these updates due for the next run.
    if (failed === 0) {
      const { error } = await db.from("updates").update({ notified_at: now.toISOString() }).in("id", updates.map((u) => u.id));
      if (error) result.errors.push(`mark notified (${well.code}): ${errorMessage(error)}`);
    }
  }

  // ---- Admin digest ----------------------------------------------------------
  // Fiji is UTC+12 and eastern Australia UTC+10; 20:00 UTC lands 6–8am locally.
  if (now.getUTCHours() >= 20) {
    const admins = await db.from("profiles").select("id, email").eq("role", "admin").eq("notify_email", true);
    // Guard with 20h, not 24h: the digest's sent_at lands a little after the run starts, so a 24h
    // guard makes the next day's run skip and the send time drift until a whole day is lost.
    const guard = new Date(now.getTime() - 20 * 3600 * 1000).toISOString();
    for (const a of admins.data ?? []) {
      const last = await db.from("notifications").select("sent_at, meta").eq("profile_id", a.id).eq("kind", "digest").order("sent_at", { ascending: false }).limit(1);
      if (last.error) { result.errors.push(`digest ${a.email}: ${errorMessage(last.error)}`); continue; }
      const lastRow = last.data?.[0] as { sent_at: string; meta: { until?: string } | null } | undefined;
      if (lastRow && lastRow.sent_at >= guard) continue;
      // Cover everything since the end of this admin's last digest window (max 3 days), so nothing
      // falls between digests. Older digests have no meta.until; their sent_at is close enough.
      const lastUntil = lastRow?.meta?.until ?? lastRow?.sent_at;
      const floor = new Date(now.getTime() - 72 * 3600 * 1000).toISOString();
      const dayAgo = lastUntil && lastUntil > floor ? lastUntil : new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

      const posted = await db
        .from("updates")
        .select("id, body, source, created_at, wells(code, name), media(kind)")
        .gte("created_at", dayAgo)
        .lte("created_at", now.toISOString())
        .order("created_at", { ascending: false });
      type PRow = { id: string; body: string | null; source: string; created_at: string; wells: { code: string; name: string } | null; media: { kind: string }[] };
      const rows = (posted.data ?? []) as unknown as PRow[];
      const misses = await db.from("signin_attempts").select("email, outcome, created_at").gte("created_at", dayAgo).lte("created_at", now.toISOString()).order("created_at", { ascending: false }).limit(50);
      const missRows = (misses.data ?? []) as { email: string; outcome: string; created_at: string }[];
      if (rows.length === 0 && missRows.length === 0) continue;

      const items = rows.map((r) => `<li><a href="${APP_URL}/admin/wells/${r.wells?.code}" style="color:#17607d;font-weight:600">${esc(r.wells?.name ?? "")}</a> <span style="color:#66787f">${r.wells?.code} · ${r.media.length} file${r.media.length === 1 ? "" : "s"} · ${r.source}</span>${r.body ? `<br><span style="color:#51666f">${esc(r.body)}</span>` : ""}</li>`).join("");
      const missMore = missRows.length >= 50 ? `<li style="color:#66787f">…and more. See the Team page.</li>` : "";
      const missItems = missRows.map((m) => `<li>${esc(m.email)} <span style="color:#66787f">· ${esc(SIGNIN_OUTCOME[m.outcome] ?? m.outcome)}</span></li>`).join("");
      const sections = [
        rows.length ? `<ul style="padding-left:18px;margin:0">${items}</ul>` : "",
        missRows.length ? `<p style="margin:${rows.length ? "16px" : "0"} 0 6px;font-weight:600">Sign-in requests that didn't get a link</p><p style="margin:0 0 6px;color:#51666f">Usually a funder using a different email from the one on file. Link the email they used to their well, then remove the old one.</p><ul style="padding-left:18px;margin:0">${missItems}${missMore}</ul>` : "",
      ].join("");
      const title = [rows.length && `${rows.length} update${rows.length === 1 ? "" : "s"}`, missRows.length && `${missRows.length} sign-in${missRows.length === 1 ? "" : "s"} without a link`].filter(Boolean).join(", ");
      const html = layout(`${title} since the last digest`, sections, `${APP_URL}/admin`, "Open admin", "WellWatch admin digest, sent once a day to Bridgit admins with email updates on.");
      const text = [
        ...rows.map((r) => `${r.wells?.name} (${r.wells?.code}): ${r.media.length} files${r.body ? ` — ${r.body}` : ""}`),
        ...(missRows.length ? ["", "Sign-in requests that didn't get a link:", ...missRows.map((m) => `${m.email} (${SIGNIN_OUTCOME[m.outcome] ?? m.outcome})`)] : []),
      ].join("\n");
      try {
        await sendEmail(a.email, `WellWatch digest: ${title}`, html, text);
        const logged = await db.from("notifications").insert({ profile_id: a.id, kind: "digest", meta: { count: rows.length, misses: missRows.length, until: now.toISOString() } });
        if (logged.error) result.errors.push(`record digest ${a.email}: ${errorMessage(logged.error)}`);
        result.digestEmails++;
      } catch (e) {
        result.errors.push(`digest ${a.email}: ${errorMessage(e)}`);
      }
    }
  }

  // Sign-in misses hold strangers' email addresses; keep them 90 days only.
  if (now.getUTCHours() === 20) {
    const cutoff = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString();
    const { error } = await db.from("signin_attempts").delete().lt("created_at", cutoff);
    if (error) result.errors.push(`signin_attempts retention: ${errorMessage(error)}`);
  }

  return result;
}
