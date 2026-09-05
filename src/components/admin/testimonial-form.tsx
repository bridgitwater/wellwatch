"use client";

import { useActionState } from "react";
import { addTestimonial, type ActionResult } from "@/lib/admin/actions";
import { Button, Field, Input, Notice, Textarea } from "./ui";

export function TestimonialForm({ wellId, code }: { wellId: string; code: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addTestimonial, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-2">
      <input type="hidden" name="well_id" value={wellId} /><input type="hidden" name="code" value={code} />
      <Field label="Name"><Input name="name" required placeholder="Kanthamma" /></Field>
      <Field label="Age"><Input name="age" type="number" min={1} max={120} /></Field>
      <Field label="Role / description" className="col-span-2"><Input name="role" placeholder="Mother of three, runs a tiffin centre" /></Field>
      <Field label="Quote" className="col-span-2"><Textarea name="quote" required className="min-h-28" placeholder="In their words, first person." /></Field>
      <Field label="Photo (Drive link or id)" className="col-span-2"><Input name="photo_file_id" placeholder="optional" /></Field>
      <div className="col-span-2 flex items-center gap-3">
        <Button variant="ghost" type="submit" disabled={pending}>{pending ? "Adding…" : "Add testimonial"}</Button>
        <Notice result={state} />
      </div>
    </form>
  );
}
