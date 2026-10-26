"use server";

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { safeNext } from "@/lib/safe-next";
import { after } from "next/server";
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
  // Admins still see every request that sent no link (daily digest, Team page).
  // Logging runs after the response so it adds no delay to these paths.
  if (error && /only request this after/i.test(error.message)) {
    // Per-person cooldown: a link went to this address under a minute ago. Say "sent" like
    // any other request (an error here would reveal the email is on file) and log nothing.
    return { status: "sent", email };
  }
  if (error && !/not\s*found|signups?\s*not\s*allowed/i.test(error.message)) {
    const detail = error.message;
    if (/rate limit/i.test(detail)) {
      after(() => logMiss(email, "rate_limited", detail));
      return { status: "error", message: "Too many sign-in emails were requested recently. Please wait a little while and try again." };
    }
    after(() => logMiss(email, "error", detail));
    return { status: "error", message: "We couldn't send the link just now. Please try again in a minute." };
  }
  if (error) after(() => logMiss(email, "not_on_file", null));
  return { status: "sent", email };
}

/** Records a sign-in request that sent no link. Never blocks or fails the sign-in itself. */
async function logMiss(email: string, outcome: "not_on_file" | "rate_limited" | "error", detail: string | null) {
  try {
    const admin = createAdminClient();
    // One row per email and outcome per hour is plenty, and keeps repeat clicks (or abuse) from filling the table.
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: recent } = await admin.from("signin_attempts").select("id").eq("email", email).eq("outcome", outcome).gte("created_at", hourAgo).limit(1);
    if (recent && recent.length) return;
    // And at most 100 rows an hour overall, so a flood of made-up emails can't bury real ones.
    const { count } = await admin.from("signin_attempts").select("id", { count: "exact", head: true }).gte("created_at", hourAgo);
    if ((count ?? 0) >= 100) return;
    const { error } = await admin.from("signin_attempts").insert({ email, outcome, detail: detail?.slice(0, 300) ?? null });
    if (error) console.error("login: could not log sign-in miss", error.message);
  } catch (e) {
    console.error("login: could not log sign-in miss", e);
  }
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
