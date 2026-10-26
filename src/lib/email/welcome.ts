import "server-only";
import { createAdminClient } from "../supabase/admin";
import { signInLink } from "../auth/links";
import { APP_URL, esc, layout, sendEmail } from "./send";

const TEAM_FOOTER = `You're receiving this because a Bridgit Water Foundation admin added you to the WellWatch team.`;

/** Welcome (or fresh sign-in link) for a Bridgit staff member. */
export async function sendTeamWelcome(email: string, name: string | null, addedBy: string | null, again = false) {
  const href = await signInLink(email, "/admin");
  const hi = name ? `Hi ${esc(name.split(" ")[0])},` : "Hi,";
  const intro = again
    ? `<p style="margin:0 0 12px">Here's a fresh link to sign in to the WellWatch admin.</p>`
    : `<p style="margin:0 0 12px">${addedBy ? `${esc(addedBy)} has` : "You've been"} added ${addedBy ? "you " : ""}to the WellWatch team as an admin. WellWatch is where Bridgit funders follow the wells they paid for, and where we keep each well's stages, photos, funders and completion details.</p>`;
  const body = `<p style="margin:0 0 12px">${hi}</p>${intro}
<p style="margin:0 0 12px">The button below signs you in and works once, for one hour. After that, go to <a href="${APP_URL}/login?next=/admin" style="color:#17607d">${APP_URL.replace(/^https?:\/\//, "")}</a> any time and enter <strong>${esc(email)}</strong> to get a new link. There's no password.</p>`;
  const text = `${name ? `Hi ${name.split(" ")[0]},` : "Hi,"}\n\n${again ? "Here's a fresh link to sign in to the WellWatch admin." : "You've been added to the WellWatch team as an admin."}\n\nSign in (works once, for one hour): ${href}\n\nAfter that, go to ${APP_URL}/login and enter ${email} to get a new link. There's no password.`;
  await sendEmail(email, again ? "Your WellWatch sign-in link" : "You've been added to WellWatch", layout(again ? "Sign in to WellWatch" : "Welcome to the WellWatch team", body, href, again ? "Sign in" : "Open the admin", TEAM_FOOTER), text);
}

/**
 * Welcome email for one funder-to-well link. Stamps welcomed_at, which is what
 * lets the hourly notifier start sending this funder update emails for the well.
 */
export async function sendFunderWelcome(wellFunderId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("well_funders")
    .select("id, profiles(email, display_name, notify_email), wells(code, name, region, country, partner_org_id, organizations(name))")
    .eq("id", wellFunderId)
    .single();
  if (error) throw error;
  const row = data as unknown as {
    id: string;
    profiles: { email: string; display_name: string | null; notify_email: boolean } | null;
    wells: { code: string; name: string; region: string | null; organizations: { name: string } | null } | null;
  };
  const email = row.profiles?.email;
  const well = row.wells;
  if (!email || !well) throw new Error("Funder or well not found");

  const href = await signInLink(email, `/wells/${well.code}`);
  const first = row.profiles?.display_name?.split(" ")[0];
  const place = [well.name, well.region].filter(Boolean).join(", ");
  const partner = well.organizations?.name;
  const body = `<p style="margin:0 0 12px">${first ? `Hi ${esc(first)},` : "Hello,"}</p>
<p style="margin:0 0 12px">Thank you for funding clean water for <strong>${esc(place)}</strong>. You can now follow the well on WellWatch: its progress from funding to handover, photos and videos from ${partner ? esc(partner) : "our partner"} on the ground, and the people it serves.</p>
${row.profiles?.notify_email === false ? `<p style="margin:0 0 12px">You've turned update emails off, so check back on WellWatch whenever you like. You can turn them on from your wells page.</p>` : `<p style="margin:0 0 12px">When the team posts something new we'll email you, at most once a day. You can turn these emails off any time from your wells page.</p>`}
<p style="margin:0 0 12px">The button below signs you in and works once, for one hour. After that, go to <a href="${APP_URL}/login?next=/wells/${well.code}" style="color:#17607d">${APP_URL.replace(/^https?:\/\//, "")}</a> and enter <strong>${esc(email)}</strong> to get a new link. There's no password.</p>`;
  const text = `${first ? `Hi ${first},` : "Hello,"}\n\nThank you for funding clean water for ${place}. You can now follow the well on WellWatch: its progress, photos and videos from the team on the ground, and the people it serves.\n\n${row.profiles?.notify_email === false ? "You've turned update emails off; check back on WellWatch whenever you like." : "We'll email you when there's news, at most once a day."}\n\nSee your well (works once, for one hour): ${href}\n\nAfter that, go to ${APP_URL}/login?next=/wells/${well.code} and enter ${email} to get a new link.`;
  await sendEmail(email, `Follow your well: ${well.name}`, layout(`Your well: ${well.name}`, body, href, "See your well"), text);

  const { error: stampErr } = await db.from("well_funders").update({ welcomed_at: new Date().toISOString() }).eq("id", row.id);
  if (stampErr) throw stampErr;
  return email;
}
