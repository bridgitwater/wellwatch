"use client";

import { useActionState } from "react";
import { addFunder, type ActionResult } from "@/lib/admin/actions";
import { Button, Field, Input, Notice } from "./ui";

export function FunderForm({ wellId, code, currency }: { wellId: string; code: string; currency: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addFunder, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="well_id" value={wellId} />
      <input type="hidden" name="code" value={code} />
      <Field label="Email" className="sm:col-span-2"><Input name="email" type="email" required placeholder="funder@example.com" /></Field>
      <Field label="Name" hint="How we greet them."><Input name="display_name" placeholder="Margaret Chen" /></Field>
      <Field label="Amount"><Input name="amount" type="number" step="0.01" /></Field>
      <Field label="Currency"><Input name="currency" defaultValue={currency} maxLength={3} /></Field>
      <Field label="Date given"><Input name="funded_at" type="date" /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_primary" /> Primary funder</label>
      <div className="sm:col-span-2 flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Linking…" : "Link funder"}</Button>
        <Notice result={state} />
      </div>
    </form>
  );
}
