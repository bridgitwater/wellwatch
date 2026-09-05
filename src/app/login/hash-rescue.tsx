"use client";

import { useEffect } from "react";

/**
 * If a sign-in link ever lands here with the session in the URL fragment
 * (e.g. Supabase fell back to the Site URL), forward it to /auth/complete.
 */
export function HashRescue({ next }: { next: string }) {
  useEffect(() => {
    if (/access_token=/.test(window.location.hash)) {
      window.location.replace(`/auth/complete?next=${encodeURIComponent(next)}${window.location.hash}`);
    }
  }, [next]);
  return null;
}
