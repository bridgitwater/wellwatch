"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly boundary for anything thrown while rendering — donors never see Next's raw error screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page error", error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center px-5 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went wrong on our side</h1>
        <p className="text-ink-2 mt-2">
          The page couldn&apos;t load just now. Please try again in a moment — if it keeps happening, write to{" "}
          <a className="underline" href="mailto:wellwatch@bridgitwater.org">wellwatch@bridgitwater.org</a> and we&apos;ll sort it out.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="rounded-md bg-water text-white px-4 py-2 font-semibold hover:bg-water-deep">
            Try again
          </button>
          <Link href="/wells" className="rounded-md border border-line px-4 py-2 font-semibold hover:border-ink-3">Your wells</Link>
        </div>
        {error.digest && <p className="text-[11px] text-ink-3 mt-6">Reference {error.digest}</p>}
      </div>
    </main>
  );
}
