"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/admin/actions";
import { Notice } from "./ui";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * An admin form that says what happened: errors always show next to the form,
 * success messages unless `quiet`. `confirm` asks before submitting (deletes).
 * `resetOnSuccess` clears "add" forms once the row is saved.
 *
 * The action is started from onSubmit rather than through <form action>, so
 * React doesn't wipe what the admin typed when a save fails.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  quiet = false,
  resetOnSuccess = false,
  noticeClassName = "",
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  /** Asked before submitting. A function gets the form's data and can return null to skip asking. */
  confirm?: string | ((fd: FormData) => string | null);
  quiet?: boolean;
  resetOnSuccess?: boolean;
  noticeClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  // Success messages fade after a few seconds; errors stay until the next try.
  const [faded, setFaded] = useState<ActionResult | null>(null);
  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    const t = setTimeout(() => setFaded(state), 4000);
    return () => clearTimeout(t);
  }, [state, resetOnSuccess]);

  const shown = state && state !== faded && (!state.ok || !quiet) ? state : null;

  return (
    <form
      ref={ref}
      action={formAction}
      aria-busy={pending}
      className={`${className ?? ""} ${pending ? "opacity-70" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        const question = typeof confirm === "function" ? confirm(fd) : confirm;
        if (question && !window.confirm(question)) return;
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      {shown && (
        <div className={`col-span-full basis-full ${noticeClassName}`} role={shown.ok ? "status" : "alert"}>
          <Notice result={shown} />
        </div>
      )}
    </form>
  );
}
