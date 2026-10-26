import "server-only";
import { createAdminClient, errorMessage } from "../supabase/admin";
import { LINK_LIFETIME, signInLink } from "../auth/links";
import { APP_URL, esc, layout, sendEmail } from "./send";
import { emailFooter, unsubscribeHeaders, unsubscribeUrl } from "./unsubscribe";

const TEAM_FOOTER = `You're receiving this because a Bridgit Water Foundation admin added you to the WellWatch team.`;

/** Welcome (or fresh sign-in link) for a Bridgit staff member. */
export async function sendTeamWelcome(email: string, name: string | null, addedBy: string | null, again = false) {
  const href = await signInLink(email, "/admin");
  const hi = name ? `Hi ${esc(name.split(" ")[0])},` : "Hi,";
  const intro = again
    ? `<p style="margin:0 0 12px">Here's a fresh link to sign in to the WellWatch admin.</p>`
    : `<p style="margin:0 0 12px">${addedBy ? `${esc(addedBy)} has` : "You've been"} added ${addedBy ? "you " : ""}to the WellWatch team as an admin. WellWatch is where Bridgit funders follow the wells they paid for, and where we keep each well's stages, photos, funders and completion details.</p>`;
  const body = `<p style="margin:0 0 12px">${hi}</p>${intro}
<p style="margin:0 0 12px">The button below signs you in and works once, for ${LINK_LIFETIME}. After that, go to <a href="${APP_URL}/login?next=/admin" style="color:#17607d">${APP_URL.replace(/^https?:\/\//, "")}</a> any time and enter <strong>${esc(email)}</strong> to get a new link. There's no password.</p>`;
  const text = `${name ? `Hi ${name.split(" ")[0]},` : "Hi,"}\n\n${again ? "Here's a fresh link to sign in to the WellWatch admin." : "You've been added to the WellWatch team as an admin."}\n\nSign in (works once, for ${LINK_LIFETIME}): ${href}\n\nAfter that, go to ${APP_URL}/login and enter ${email} to get a new link. There's no password.`;
  await sendEmail(email, again ? "Your WellWatch sign-in link" : "You've been added to WellWatch", layout(again ? "Sign in to WellWatch" : "Welcome to the WellWatch team", body, href, again ? "Sign in" : "Open the admin", TEAM_FOOTER), text);
}

type Funder = { id: string; email: string; display_name: string | null; notify_email: boolean };
type WellRef = { code: string; name: string; region: string | null; partner: string | null };
type LinkRow = { id: string; welcomed_at: string | null; profile_id: string; profiles: Funder | null; wells: { code: string; name: string; region: string | null; organizations: { name: string } | null } | null };

/** Everything a funder's welcome needs, for a set of funder-to-well links. */
async function loadLinks(db: ReturnType<typeof createAdminClient>, linkIds: string[]): Promise<LinkRow[]> {
  if (!linkIds.length) return [];
  const { data, error } = await db
    .from("well_funders")
    .select("id, welcomed_at, profile_id, profiles(id, email, display_name, notify_email), wells(code, name, region, organizations(name))")
    .in("id", linkIds);
  if (error) throw error;
  return (data ?? []) as unknown as LinkRow[];
}

const wellRef = (r: LinkRow): WellRef => ({ code: r.wells!.code, name: r.wells!.name, region: r.wells!.region, partner: r.wells!.organizations?.name ?? null });

/**
 * The funder welcome, as HTML and text. One email covers all the wells being welcomed
 * for this person (SMEC funds nine at once): a separate email per well would send nine
 * sign-in links, and each new link cancels the one before.
 */
export function renderFunderWelcome(funder: Funder, wells: WellRef[], href: string) {
  const first = funder.display_name?.split(" ")[0];
  const one = wells.length === 1 ? wells[0] : null;
  const place = (w: WellRef) => [w.name, w.region].filter(Boolean).join(", ");
  const partners = [...new Set(wells.map((w) => w.partner).filter(Boolean))] as string[];
  const by = partners.length === 1 ? esc(partners[0]) : "our partners";
  const back = one ? `/login?next=/wells/${one.code}` : "/login?next=/wells";
  const subject = one ? `Follow your well: ${one.name}` : `Follow your ${wells.length} wells on WellWatch`;
  const title = one ? `Your well: ${one.name}` : `Your ${wells.length} wells`;
  const thanks = one
    ? `<p style="margin:0 0 12px">Thank you for funding clean water for <strong>${esc(place(one))}</strong>. You can now follow the well on WellWatch: its progress from funding to handover, photos and videos from ${by} on the ground, and the people it serves.</p>`
    : `<p style="margin:0 0 12px">Thank you for funding clean water for ${wells.length} communities. You can now follow each of them on WellWatch: progress from funding to handover, photos and videos from ${by} on the ground, and the people they serve.</p><ul style="margin:0 0 12px;padding-left:18px">${wells.map((w) => `<li>${esc(place(w))}</li>`).join("")}</ul>`;
  const emails = funder.notify_email === false
    ? `<p style="margin:0 0 12px">You've turned update emails off, so check back on WellWatch whenever you like. You can turn them on from your wells page.</p>`
    : `<p style="margin:0 0 12px">When the team posts something new we'll email you, at most once a day per well. You can turn these emails off any time.</p>`;
  const html = layout(title, `<p style="margin:0 0 12px">${first ? `Hi ${esc(first)},` : "Hello,"}</p>
${thanks}
${emails}
<p style="margin:0 0 12px">The button below signs you in and works once, for ${LINK_LIFETIME}. After that, go to <a href="${APP_URL}${back}" style="color:#17607d">${APP_URL.replace(/^https?:\/\//, "")}</a> and enter <strong>${esc(funder.email)}</strong> to get a new link. There's no password.</p>`,
    href, one ? "See your well" : "See your wells",
    emailFooter(funder.id, "You're receiving this because you funded a well with Bridgit Water Foundation."));
  const text = `${first ? `Hi ${first},` : "Hello,"}\n\n${one ? `Thank you for funding clean water for ${place(one)}.` : `Thank you for funding clean water for ${wells.length} communities:\n${wells.map((w) => `- ${place(w)}`).join("\n")}`}\nYou can now follow ${one ? "it" : "them"} on WellWatch: progress, photos and videos from the team on the ground, and the people ${one ? "it serves" : "they serve"}.\n\n${funder.notify_email === false ? "You've turned update emails off; check back on WellWatch whenever you like." : "We'll email you when there's news, at most once a day per well."}\n\nSign in (works once, for ${LINK_LIFETIME}): ${href}\n\nAfter that, go to ${APP_URL}${back} and enter ${funder.email} to get a new link.\n\nUnsubscribe: ${unsubscribeUrl(funder.id)}`;
  return { subject, html, text };
}

/** What a funder would receive, without sending anything or making a sign-in link. For the admin preview. */
export async function previewFunderWelcome(linkIds: string[]) {
  const rows = (await loadLinks(createAdminClient(), linkIds)).filter((r) => r.profiles && r.wells);
  if (!rows.length) return null;
  const funder = rows[0].profiles!;
  const mine = rows.filter((r) => r.profile_id === funder.id);
  const next = mine.length === 1 ? `/wells/${mine[0].wells!.code}` : "/wells";
  return { to: funder.email, ...renderFunderWelcome(funder, mine.map(wellRef), `${APP_URL}${next}`) };
}

export type WelcomeResult = { email: string; wells: number; ok: boolean; error?: string };

/**
 * Sends welcomes for a set of funder-to-well links: one email per funder, covering all of
 * their links in the set. For each funder, welcomed_at is claimed on their links BEFORE
 * the email goes and put back if sending fails, so two admins (or a double-click) can't
 * send twice, and a welcome that went out is never left unrecorded. Links welcomed in the
 * last two minutes are skipped. Sends one at a time (Resend allows about two a second).
 */
export async function sendWelcomes(linkIds: string[]): Promise<WelcomeResult[]> {
  const db = createAdminClient();
  const rows = (await loadLinks(db, linkIds)).filter((r) => r.profiles && r.wells);
  const byFunder = new Map<string, LinkRow[]>();
  for (const r of rows) byFunder.set(r.profile_id, [...(byFunder.get(r.profile_id) ?? []), r]);

  const results: WelcomeResult[] = [];
  let first = true;
  for (const links of byFunder.values()) {
    const funder = links[0].profiles!;
    if (!first) await new Promise((r) => setTimeout(r, 600));
    first = false;
    const claimed: LinkRow[] = [];
    // Put each claimed link back as it was, so the button offers it again.
    const restore = async () => {
      for (const l of claimed) {
        const { error } = await db.from("well_funders").update({ welcomed_at: l.welcomed_at }).eq("id", l.id);
        if (error) console.error("welcome: could not restore welcomed_at", l.id, error.message);
      }
    };
    try {
      // Claim each link: only those never welcomed, or welcomed more than two minutes ago.
      // Counted rather than returned: PostgREST rejects an or-filter on the column being
      // updated when the updated rows are asked for back ("column … does not exist").
      const now = new Date().toISOString();
      const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      for (const l of links) {
        const { count, error } = await db
          .from("well_funders")
          .update({ welcomed_at: now }, { count: "exact" })
          .eq("id", l.id)
          .or(`welcomed_at.is.null,welcomed_at.lt."${recent}"`);
        if (error) throw new Error(`WellWatch couldn't record the welcome, so nothing was sent. Try again in a minute. (${errorMessage(error)})`);
        if (count) claimed.push(l);
      }
      if (!claimed.length) {
        results.push({ email: funder.email, wells: 0, ok: false, error: `A welcome went to ${funder.email} in the last two minutes. Give it a few minutes before sending another (a new one cancels the link in the last).` });
        continue;
      }
      const next = claimed.length === 1 ? `/wells/${claimed[0].wells!.code}` : "/wells";
      const href = await signInLink(funder.email, next);
      const { subject, html, text } = renderFunderWelcome(funder, claimed.map(wellRef), href);
      await sendEmail(funder.email, subject, html, text, unsubscribeHeaders(funder.id));
      results.push({ email: funder.email, wells: claimed.length, ok: true });
    } catch (e) {
      // Nothing was sent (a claim, the link or the email failed): undo every claim made so far.
      await restore();
      results.push({ email: funder.email, wells: 0, ok: false, error: errorMessage(e) });
    }
  }
  return results;
}

/** One funder-to-well link, for the button on a well's page. Returns the funder's email; throws with a readable message. */
export async function sendFunderWelcome(wellFunderId: string): Promise<string> {
  const [r] = await sendWelcomes([wellFunderId]);
  if (!r) throw new Error("Funder or well not found");
  if (!r.ok) throw new Error(r.error ?? "The welcome couldn't be sent");
  return r.email;
}
