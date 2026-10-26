"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { landingFor } from "@/lib/auth/landing";

/**
 * Finishes a sign-in link only when the person presses the button. Mail scanners
 * fetch links but don't press buttons, so they can't use the one-time token up.
 */
export function ConfirmSignIn({ tokenHash, next }: { tokenHash: string; next: string }) {
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  async function go() {
    setBusy(true);
    setOffline(false);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { detectSessionInUrl: false },
      });
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error && (isAuthRetryableFetchError(error) || error.status === 0)) throw error;
      if (error) {
        // Old or used link. Don't carry on as whoever is already signed in on this device
        // (a shared computer could be someone else): show "expired" and let them ask again.
        window.location.replace(`/login?error=link_expired&next=${encodeURIComponent(next)}`);
        return;
      }
      window.location.replace(await landingFor(supabase, next));
    } catch {
      // Couldn't reach WellWatch: the link is probably still good, so let them try again.
      setOffline(true);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="text-xs font-semibold tracking-[0.12em] uppercase text-water">Bridgit Water</div>
      <h1 className="text-3xl font-bold mt-1">Sign in to WellWatch</h1>
      <p className="text-ink-2 mt-3">Press the button to finish signing in.</p>
      <button
        type="button"
        onClick={go}
        disabled={busy || !tokenHash}
        className="mt-6 w-full rounded-lg bg-water text-white font-semibold px-4 py-3 disabled:opacity-60 hover:bg-water-deep transition-colors"
      >
        {busy ? "Signing you in…" : "Continue to WellWatch"}
      </button>
      {offline && (
        <p role="alert" className="mt-4 text-sm text-clay">We couldn&apos;t reach WellWatch. Check your connection and press the button again.</p>
      )}
      <p className="mt-6 text-sm text-ink-3">
        Link not working? <a className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Get a new sign-in link</a>.
      </p>
    </div>
  );
}
