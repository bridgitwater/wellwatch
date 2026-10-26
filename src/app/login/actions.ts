"use server";

import { z } from "zod";
import { after } from "next/server";
import { headers } from "next/headers";
import { safeNext } from "@/lib/safe-next";
import { emailSchema } from "@/lib/email-address";
import { createAdminClient, errorMessage } from "@/lib/supabase/admin";
import { sendSignInEmail } from "@/lib/email/signin";

export type LoginState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const schema = z.object({
  email: emailSchema,
  // Same-origin path only: "//evil.example" passes startsWith("/") but is an open redirect.
  next: z.unknown().transform((v) => safeNext(v)),
});

/**
 * Emails a sign-in link to people on file. Everyone is told "a link is on its way",
 * so strangers can't learn which emails we hold; the response does the same work
 * (one profile lookup, one limiter call) whether or not the email is on file, and
 * the link itself is made and sent after the response. Requests that send nothing
 * are logged for admins (daily digest, Team page).
 *
 * WellWatch sends this email itself rather than through Supabase Auth: Supabase's
 * project-wide allowance (30 an hour) could be used up by anyone, locking every
 * funder out, and its links sign in on a plain GET, which mail scanners burn.
 */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { email, next } = parsed.data;

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  try {
    const admin = createAdminClient();
    const { data: profile, error: findErr } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (findErr) throw findErr;
    const { data: verdict, error: limitErr } = await admin.rpc("signin_allow", { p_email: email, p_ip: ip, p_on_file: Boolean(profile) });
    if (limitErr) throw limitErr;

    if (verdict === "ok") {
      after(async () => {
        try {
          await sendSignInEmail(email, next);
        } catch (e) {
          await logMiss(email, "error", errorMessage(e));
        }
      });
    } else if (verdict === "not_on_file") {
      after(() => logMiss(email, "not_on_file", null));
    } else if (verdict !== "email_cooldown") {
      // email_cooldown: a link went out under a minute ago and a new one would cancel it. Nothing to report.
      after(() => logMiss(email, "rate_limited", String(verdict)));
    }
  } catch (e) {
    // Only reached when WellWatch's own database is unreachable, for any email alike.
    const detail = errorMessage(e);
    after(() => logMiss(email, "error", detail));
    return { status: "error", message: "We couldn't send the link just now. Please try again in a minute." };
  }
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
