"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, errorMessage } from "../supabase/admin";
import { emailSchema } from "../email-address";
import { createAccount, profileIdFor } from "./funders";
import { sendTeamWelcome } from "../email/welcome";
import { requireAdmin } from "./guard";
import type { ActionResult } from "./actions";

const memberSchema = z.object({
  email: emailSchema,
  display_name: z.string().trim().max(120).transform((s) => (s === "" ? null : s)),
});

/**
 * Makes someone a WellWatch admin: creates a confirmed account if they don't
 * have one (or promotes their existing funder account) and emails them a
 * welcome with a sign-in link. Uses the service role after requireAdmin(),
 * because role changes are locked for everyone else.
 */
export async function addTeamMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = memberSchema.safeParse({ email: fd.get("email"), display_name: fd.get("display_name") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, display_name } = parsed.data;
  const db = createAdminClient();

  try {
    const { data: existing, error: findErr } = await db.from("profiles").select("id, role").eq("email", email).maybeSingle();
    if (findErr) throw findErr;
    if (existing?.role === "admin") return { ok: false, error: `${email} is already an admin. Use “Send sign-in link” if they need a new link.` };

    // Create the account if needed (safe if another admin is adding the same person right now),
    // confirm it, then raise the role. The role is set here, never read from sign-up metadata.
    const id = existing?.id ?? (await profileIdFor(db, email)) ?? (await createAccount(db, email, display_name));
    const { error: confirmErr } = await db.auth.admin.updateUserById(id, { email_confirm: true });
    if (confirmErr) throw confirmErr;
    const patch: { role: "admin"; display_name?: string } = { role: "admin" };
    if (display_name) patch.display_name = display_name;
    const { data: raised, error } = await db.from("profiles").update(patch).eq("id", id).neq("role", "admin").select("id");
    if (error) throw error;
    if (!raised?.length) return { ok: false, error: `${email} was made an admin a moment ago (by another admin?). Check the list.` };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }

  revalidatePath("/admin/team");
  try {
    await sendTeamWelcome(email, display_name, me.display_name ?? me.email);
  } catch (e) {
    return { ok: false, error: `${email} is now an admin, but the welcome email failed: ${errorMessage(e)}. Try “Send sign-in link”.` };
  }
  return { ok: true, message: `${email} added. Their welcome email is on its way.` };
}

/** Emails a team member a fresh sign-in link (replacing any earlier one). Admins only. */
export async function resendTeamLink(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: member, error } = await db.from("profiles").select("email, display_name, role").eq("id", String(fd.get("id") ?? "")).maybeSingle();
  if (error) return { ok: false, error: errorMessage(error) };
  if (!member || member.role !== "admin") return { ok: false, error: "That person isn't an admin." };
  try {
    await sendTeamWelcome(member.email, member.display_name, null, true);
    return { ok: true, message: `Link sent to ${member.email}` };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Removes admin access. They keep their account (and any wells they funded) as a funder. */
export async function removeTeamMember(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (id === me.id) return { ok: false, error: "You can't remove your own admin access." };
  const db = createAdminClient();
  // demote_admin() locks the admin list, so two admins removing each other at once can't leave nobody.
  const { data: verdict, error } = await db.rpc("demote_admin", { p_target: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/admin/team");
  if (verdict === "not_admin") return { ok: false, error: "That person isn't an admin any more." };
  if (verdict === "last_admin") return { ok: false, error: "WellWatch needs at least one admin, so this one stays." };
  return { ok: true, message: "Admin access removed" };
}
