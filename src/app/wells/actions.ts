"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Funder toggles their own email notifications. RLS limits the update to their own row. */
export async function setNotifyEmail(fd: FormData): Promise<void> {
  const on = fd.get("on") === "1";
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("profiles").update({ notify_email: on }).eq("id", data.user.id);
  revalidatePath("/wells", "layout");
}
