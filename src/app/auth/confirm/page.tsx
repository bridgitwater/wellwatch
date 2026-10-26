import type { Metadata } from "next";
import { ConfirmSignIn } from "./confirm";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

/** Landing page for sign-in links in WellWatch's own emails (team and funder welcomes). */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const tokenHash = typeof sp.token_hash === "string" ? sp.token_hash : "";
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-12">
      <ConfirmSignIn tokenHash={tokenHash} next={next} />
    </main>
  );
}
