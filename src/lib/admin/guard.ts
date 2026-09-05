import { notFound } from "next/navigation";
import { getProfile } from "../data";
import type { Profile } from "../types";

/** Server-side gate for admin pages and actions. RLS is the real guard; this gives a clean 404. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") notFound();
  return profile;
}
