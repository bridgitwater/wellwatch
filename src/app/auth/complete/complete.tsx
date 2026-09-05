"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/** Finishes an implicit-flow magic link: reads the tokens from the URL fragment and stores the session. */
export function CompleteSignIn({ next }: { next: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const errorDesc = params.get("error_description");
    if (!access_token || !refresh_token) {
      window.location.replace(`/login?error=link_expired&next=${encodeURIComponent(next)}${errorDesc ? `&detail=${encodeURIComponent(errorDesc)}` : ""}`);
      return;
    }
    // Implicit flow, and don't let the client also try to parse the hash — we do it once, here.
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { flowType: "implicit", detectSessionInUrl: false },
    });
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) setFailed(true);
        else window.location.replace(next);
      });
  }, [next]);

  return (
    <div className="text-center text-ink-2">
      {failed ? (
        <>
          <p className="font-semibold text-ink">We couldn&apos;t finish signing you in.</p>
          <a className="underline" href="/login">Request a new link</a>
        </>
      ) : (
        <p>Signing you in…</p>
      )}
    </div>
  );
}
