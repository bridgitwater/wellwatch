"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, errorMessage } from "../supabase/admin";
import { sendTeamWelcome } from "../email/welcome";
import { requireAdmin } from "./guard";
import type { ActionResult } from "./actions";

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
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
    const { data: existing, error: findErr } = await db.from("profiles").select("id, role, display_name").eq("email", email).maybeSingle();
    if (findErr) throw findErr;
    if (existing?.role === "admin") return { ok: false, error: `${email} is already an admin. Use “Send sign-in link” if they need a new link.` };

    if (existing) {
      const patch: { role: "admin"; display_name?: string } = { role: "admin" };
      if (display_name && !existing.display_name) patch.display_name = display_name;
      const { error } = await db.from("profiles").update(patch).eq("id", existing.id);
      if (error) throw error;
      const { error: confirmErr } = await db.auth.admin.updateUserById(existing.id, { email_confirm: true });
      if (confirmErr) throw confirmErr;
    } else {
      const { error } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: display_name ?? undefined, role: "admin" },
      });
      if (error) throw error;
    }
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
  const { data, error } = await db.from("profiles").update({ role: "funder" }).eq("id", id).eq("role", "admin").select("email");
  if (error) return { ok: false, error: errorMessage(error) };
  if (!data?.length) return { ok: false, error: "That person isn't an admin any more." };
  revalidatePath("/admin/team");
  return { ok: true, message: `Admin access removed for ${data[0].email}` };
}
