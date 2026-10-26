import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where to go right after signing in. People who asked for a page get it; the
 * default (/wells, the funder list) becomes /admin for Bridgit staff.
 */
export async function landingFor(supabase: SupabaseClient, next: string): Promise<string> {
  if (next !== "/wells") return next;
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return next;
    const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    return data?.role === "admin" ? "/admin" : next;
  } catch {
    return next;
  }
}
