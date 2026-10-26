import "server-only";
import { createAdminClient } from "../supabase/admin";
import { APP_URL } from "../email/send";

/**
 * A one-time sign-in link for someone already on file, for emails WellWatch
 * sends itself (team and funder welcomes). It points at /auth/confirm, where the
 * person presses a button to finish signing in: corporate mail scanners open
 * links before people do, and a link that signed in on GET would be used up.
 *
 * Valid for the project's email OTP lifetime. Each new link (or sign-in email)
 * replaces the person's previous one. Refuses emails that aren't on file, so it
 * can never create an account.
 */
export async function signInLink(email: string, next: string): Promise<string> {
  const admin = createAdminClient();
  const { data: profile, error: findErr } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (findErr) throw findErr;
  if (!profile) throw new Error(`${email} isn't on file in WellWatch`);

  // Someone added through Supabase's own "Invite user" may never have confirmed; confirm first.
  const { data: u, error: getErr } = await admin.auth.admin.getUserById(profile.id);
  if (getErr) throw getErr;
  if (!u.user?.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(profile.id, { email_confirm: true });
    if (error) throw error;
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const hash = data.properties?.hashed_token;
  if (!hash || data.properties?.verification_type !== "magiclink") throw new Error("Supabase didn't return a sign-in link");
  const q = new URLSearchParams({ token_hash: hash, next });
  return `${APP_URL}/auth/confirm?${q.toString()}`;
}
