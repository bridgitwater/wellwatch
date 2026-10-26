import "server-only";
import { createAdminClient } from "../supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** The profile id for an email, waiting briefly for one another request is creating right now. */
export async function profileIdFor(db: Admin, email: string, attempts = 1): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return null;
}

/**
 * Creates a confirmed sign-in account (the on_auth_user_created trigger adds the
 * profile, as a funder). If another admin or an import created the same person a
 * moment earlier, Supabase refuses the duplicate; we then use theirs. Returns the
 * profile id. Service role: callers must already have run requireAdmin().
 */
export async function createAccount(db: Admin, email: string, displayName: string | null): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    // The role is never taken from metadata here: it defaults to funder and is raised explicitly.
    user_metadata: { display_name: displayName ?? undefined },
  });
  if (!error) return data.user.id;
  const id = await profileIdFor(db, email, 4);
  if (id) return id;
  throw new Error(
    /already|exists|registered/i.test(error.message)
      ? `${email} has a sign-in account but no WellWatch profile. Ask Dusty to repair it.`
      : error.message,
  );
}

/** Finds or creates the funder profile for an email. Service role: call only after requireAdmin(). */
export async function ensureFunderProfile(email: string, displayName: string | null): Promise<string> {
  const db = createAdminClient();
  return (await profileIdFor(db, email)) ?? (await createAccount(db, email, displayName));
}
