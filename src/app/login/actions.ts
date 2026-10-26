"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { safeNext } from "@/lib/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  // Same-origin path only: "//evil.example" passes startsWith("/") but is an open redirect.
  next: z.unknown().transform((v) => safeNext(v)),
});

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, next } = parsed.data;
  // Implicit flow (not PKCE): the emailed link must work from ANY browser or device,
  // not only the one that requested it. NB: @supabase/ssr's createServerClient
  // silently forces flowType "pkce", so this must be a plain supabase-js client.
  // The session lands in the URL fragment and /auth/complete turns it into cookies.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const send = () => supabase.auth.signInWithOtp({
    email,
    options: {
      // Only people the admin has invited can sign in; strangers get the same
      // "check your email" message but no account is created.
      shouldCreateUser: false,
      // Straight to the client-side completer: the session arrives in the URL
      // fragment, so a server hop via /auth/callback would only add a redirect.
      emailRedirectTo: `${appUrl}/auth/complete?next=${encodeURIComponent(next)}`,
    },
  });

  let { error } = await send();

  // An invited-but-never-confirmed user (e.g. someone added with Supabase's
  // "Invite user" who never clicked the invite in time) is treated by Supabase
  // as a new signup, and signups are disabled, so no link is ever sent. If an
  // admin has put this person on file, confirm their email and try again.
  if (error && (error as { code?: string }).code === "signup_disabled") {
    if (await confirmInvitedUser(email)) ({ error } = await send());
  }

  // Don't reveal whether an email is on file; treat "user not found" as sent.
  if (error && !/not\s*found|signups?\s*not\s*allowed/i.test(error.message)) {
    if (/rate limit/i.test(error.message)) {
      return { status: "error", message: "Too many sign-in emails were requested recently. Please wait a little while and try again." };
    }
    return { status: "error", message: "We couldn't send the link just now. Please try again in a minute." };
  }
  return { status: "sent", email };
}

/** Confirms the email of an existing, unconfirmed auth user who has a profile. Returns true if it did. */
async function confirmInvitedUser(email: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) return false;
    const { error } = await admin.auth.admin.updateUserById(profile.id, { email_confirm: true });
    if (error) {
      console.error("login: could not confirm invited user", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("login: confirmInvitedUser failed", e);
    return false;
  }
}
