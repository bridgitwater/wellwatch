"use client";

import { useEffect } from "react";

/**
 * If a sign-in link ever lands here with the session in the URL fragment
 * (e.g. Supabase fell back to the Site URL), forward it to /auth/complete.
 */
export function HashRescue({ next }: { next: string }) {
  useEffect(() => {
    const hash = window.location.hash;
    if (/access_token=/.test(hash)) {
      window.location.replace(`/auth/complete?next=${encodeURIComponent(next)}${hash}`);
    } else if (/error=/.test(hash) && !new URLSearchParams(window.location.search).has("error")) {
      // An expired or used invite/sign-in link: say so instead of silently showing the form.
      window.location.replace(`/login?error=link_expired&next=${encodeURIComponent(next)}`);
    }
  }, [next]);
  return null;
}
