"use client";

import { useActionState } from "react";
import { updateOrganization, type ActionResult } from "@/lib/admin/actions";
import { Button, Field, Input, Notice, Textarea } from "./ui";
import type { Partner } from "@/lib/types";

export function PartnerForm({ org }: { org: Partner }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateOrganization, null);
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-water font-semibold list-none">Edit details</summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={org.id} />
        <Field label="Name"><Input name="name" defaultValue={org.name} required /></Field>
        <Field label="Country code"><Input name="country" defaultValue={org.country ?? ""} maxLength={2} /></Field>
        <Field label="Contact name"><Input name="contact_name" defaultValue={org.contact_name ?? ""} placeholder="Steven Beingana" /></Field>
        <Field label="Contact title"><Input name="contact_title" defaultValue={org.contact_title ?? ""} placeholder="Director" /></Field>
        <Field label="Website"><Input name="website" defaultValue={org.website ?? ""} placeholder="suubi.org" /></Field>
        <Field label="Logo (Drive link or id)"><Input name="logo_file_id" defaultValue={org.logo_file_id ?? ""} /></Field>
        <Field label="Introduction for funders" className="sm:col-span-2" hint="Two or three sentences: who they are, how long they've worked with Bridgit, what you've built together.">
          <Textarea name="intro" defaultValue={org.intro ?? ""} />
        </Field>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          <Notice result={state} />
        </div>
      </form>
    </details>
  );
}
