"use client";

import { addFunder } from "@/lib/admin/actions";
import { ActionForm } from "./action-form";
import { Button, Field, Input } from "./ui";

export function FunderForm({ wellId, code, currency }: { wellId: string; code: string; currency: string }) {
  // Keeps what was typed if linking fails; clears once the funder is linked.
  return (
    <ActionForm action={addFunder} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="well_id" value={wellId} />
      <input type="hidden" name="code" value={code} />
      <Field label="Email" className="sm:col-span-2"><Input name="email" type="email" required placeholder="funder@example.com" /></Field>
      <Field label="Name" hint="How we greet them."><Input name="display_name" placeholder="Margaret Chen" /></Field>
      <Field label="Amount"><Input name="amount" type="number" step="0.01" /></Field>
      <Field label="Currency"><Input name="currency" defaultValue={currency} maxLength={3} /></Field>
      <Field label="Date given"><Input name="funded_at" type="date" /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_primary" /> Primary funder</label>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="send_welcome" className="mt-1" />
        <span>Send their welcome email now<span className="block text-xs text-ink-3">Leave unticked to link them quietly. They get no emails at all until you send the welcome from the list above.</span></span>
      </label>
      <div className="sm:col-span-2 flex items-center gap-4">
        <Button type="submit">Link funder</Button>
      </div>
    </ActionForm>
  );
}
