"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="rounded-xl bg-aquifer px-5 py-5">
        <div className="font-semibold text-water-deep">Check your email</div>
        <p className="text-sm text-ink-2 mt-1">
          If <span className="font-medium text-ink">{state.email}</span> is linked to a well, a sign-in link is on its way.
          It works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="text-sm font-medium" htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="rounded-lg border border-line bg-surface px-4 py-3 text-base placeholder:text-ink-3"
      />
      {state.status === "error" && <p className="text-sm text-clay">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-water text-white font-semibold px-4 py-3 disabled:opacity-60 hover:bg-water-deep transition-colors"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
