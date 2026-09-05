"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  next: z.string().startsWith("/").catch("/wells"),
});

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), next: formData.get("next") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, next } = parsed.data;
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Only people the admin has invited can sign in; strangers get the same
      // "check your email" message but no account is created.
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  // Don't reveal whether an email is on file; treat "user not found" as sent.
  if (error && !/not\s*found|signups?\s*not\s*allowed/i.test(error.message)) {
    return { status: "error", message: "We couldn't send the link just now. Please try again in a minute." };
  }
  return { status: "sent", email };
}
