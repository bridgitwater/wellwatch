import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";

export const metadata: Metadata = { title: "Email updates" };
export const dynamic = "force-dynamic";

/** Landing page for the "Unsubscribe" link in WellWatch emails. Asks before changing anything. */
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const sp = await searchParams;
  const u = typeof sp.u === "string" ? sp.u : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const done = sp.done === "off" || sp.done === "on" ? sp.done : null;
  const valid = verifyUnsubscribe(u, t);

  let current: boolean | null = null;
  if (valid) {
    const { data } = await createAdminClient().from("profiles").select("notify_email").eq("id", u).maybeSingle();
    current = data ? data.notify_email : null;
  }
  const action = (on: boolean) => `/api/unsubscribe?${new URLSearchParams({ u, t, ...(on ? { on: "1" } : {}) }).toString()}`;
  const btn = "mt-6 w-full rounded-lg font-semibold px-4 py-3 transition-colors";

  return (
    <main className="flex-1 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="text-xs font-semibold tracking-[0.12em] uppercase text-water">Bridgit Water · WellWatch</div>
        {!valid || current === null ? (
          <>
            <h1 className="text-3xl font-bold mt-1">This link doesn&apos;t work</h1>
            <p className="text-ink-2 mt-3">
              It may have been copied incompletely. You can turn emails off from your wells page after signing in, or write to{" "}
              <a className="underline" href="mailto:wellwatch@bridgitwater.org">wellwatch@bridgitwater.org</a>.
            </p>
          </>
        ) : current ? (
          <>
            <h1 className="text-3xl font-bold mt-1">{done === "on" ? "Emails are back on" : "Stop WellWatch emails?"}</h1>
            <p className="text-ink-2 mt-3">
              {done === "on"
                ? "You'll hear from us when there's news from your well, at most once a day."
                : "You'll stop getting emails about new photos and progress. Your well's page stays available whenever you sign in."}
            </p>
            {done !== "on" && (
              <form method="post" action={action(false)}>
                <button type="submit" className={`${btn} bg-water text-white hover:bg-water-deep`}>Turn off WellWatch emails</button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold mt-1">You&apos;re unsubscribed</h1>
            <p className="text-ink-2 mt-3">You won&apos;t get WellWatch update emails any more. Your well&apos;s page is still there whenever you sign in.</p>
            <form method="post" action={action(true)}>
              <button type="submit" className={`${btn} border border-line text-ink-2 hover:text-ink`}>Changed your mind? Turn emails back on</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
