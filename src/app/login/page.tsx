import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { HashRescue } from "./hash-rescue";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/wells";
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="flex-1 flex items-center justify-center px-5 py-12">
      <HashRescue next={next} />
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-xs font-semibold tracking-[0.12em] uppercase text-water">BridgIT Water</div>
          <h1 className="text-3xl font-bold mt-1">Your wells</h1>
          <p className="text-ink-2 mt-2">
            Enter the email you gave when you funded a well. We&apos;ll send you a sign-in link — no password needed.
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-clay-soft text-clay px-4 py-3 text-sm">
            {error === "link_expired"
              ? "That sign-in link has expired or was already used. Request a new one below."
              : "Something went wrong signing you in. Please request a new link."}
          </div>
        )}
        <LoginForm next={next} />
        <p className="mt-8 text-sm text-ink-3">
          Not getting an email? Check spam, or write to{" "}
          <a className="underline" href="mailto:wells@bridgitwater.org">wells@bridgitwater.org</a>.
        </p>
      </div>
    </main>
  );
}
