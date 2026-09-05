import "server-only";
import { createAdminClient } from "../supabase/admin";

/**
 * Finds or creates the auth user + profile for a funder email. Uses the service
 * role, so it must only ever be called from code that has already run requireAdmin().
 */
export async function ensureFunderProfile(email: string, displayName: string | null): Promise<string> {
  const admin = createAdminClient();
  const existing = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing.data) return existing.data.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? undefined, role: "funder" },
  });
  if (error) throw error;
  // The on_auth_user_created trigger creates the profile row.
  return data.user.id;
}
