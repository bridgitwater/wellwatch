import Link from "next/link";
import type { Profile } from "@/lib/types";
import { setNotifyEmail } from "@/app/wells/actions";

export function Shell({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/wells" className="flex items-baseline gap-2 no-underline">
            <span className="display font-bold text-lg text-ink">WellWatch</span>
            <span className="text-xs text-ink-3 hidden sm:inline">by Bridgit Water</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {profile?.role === "admin" && (
              <Link href="/admin" className="text-ink-2 hover:text-ink">Admin</Link>
            )}
            {profile && (
              <form action={setNotifyEmail}>
                <input type="hidden" name="on" value={profile.notify_email ? "0" : "1"} />
                <button type="submit" className="text-ink-2 hover:text-ink" title={profile.notify_email ? "Turn email updates off" : "Turn email updates on"}>
                  <span className="hidden sm:inline">Email updates: </span>
                  <span className="sm:hidden" aria-hidden="true">✉ </span>
                  <span className="font-semibold">{profile.notify_email ? "on" : "off"}</span>
                </button>
              </form>
            )}
            {profile && (
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-ink-2 hover:text-ink">Sign out</button>
              </form>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line mt-16">
        <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-ink-3 flex flex-wrap gap-x-4 gap-y-1">
          <span>Bridgit Water Foundation · Australian Charity CH1853</span>
          <a className="hover:text-ink-2" href="https://bridgitwater.org">bridgitwater.org</a>
          <a className="hover:text-ink-2" href="mailto:wells@bridgitwater.org">wells@bridgitwater.org</a>
        </div>
      </footer>
    </>
  );
}
