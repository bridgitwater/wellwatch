"use client";

import { useActionState } from "react";
import { createWell, updateWell, type ActionResult } from "@/lib/admin/actions";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";
import { COUNTRY_NAME } from "@/lib/format";
import type { Well } from "@/lib/types";

type Org = { id: string; name: string };

export function WellForm({ well, orgs }: { well?: Well & { exact_lat?: number | null; exact_lng?: number | null; partner_org_id?: string | null }; orgs: Org[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(well ? updateWell : createWell, null);
  const w = well;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {w && <input type="hidden" name="id" value={w.id} />}
      <Field label="Code" hint="Country-year-sequence, e.g. UG-2026-014. Also the Drive folder prefix.">
        <Input name="code" defaultValue={w?.code} required pattern="[A-Z]{2}-\d{4}-\d{3}" placeholder="UG-2026-014" readOnly={Boolean(w)} className={w ? "bg-bg" : ""} />
      </Field>
      <Field label="Community name" hint="What funders see as the well's name.">
        <Input name="name" defaultValue={w?.name} required placeholder="Kyabirwa" />
      </Field>
      <Field label="Country">
        <Select name="country" defaultValue={w?.country ?? "UG"} required>
          {Object.entries(COUNTRY_NAME).filter(([c]) => c !== "AU").map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </Select>
      </Field>
      <Field label="Partner organization">
        <Select name="partner_org_id" defaultValue={w?.partner_org_id ?? ""}>
          <option value="">—</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </Field>
      <Field label="Region / district"><Input name="region" defaultValue={w?.region ?? ""} placeholder="Jinja District" /></Field>
      <Field label="Village"><Input name="village" defaultValue={w?.village ?? ""} /></Field>
      <Field label="Approximate latitude" hint="Village centre — shown to funders."><Input name="approx_lat" type="number" step="any" defaultValue={w?.approx_lat ?? ""} /></Field>
      <Field label="Approximate longitude"><Input name="approx_lng" type="number" step="any" defaultValue={w?.approx_lng ?? ""} /></Field>
      <Field label="Exact latitude" hint="Borehole GPS — admins and partners only."><Input name="exact_lat" type="number" step="any" defaultValue={w?.exact_lat ?? ""} /></Field>
      <Field label="Exact longitude"><Input name="exact_lng" type="number" step="any" defaultValue={w?.exact_lng ?? ""} /></Field>
      <Field label="People served"><Input name="people_served" type="number" defaultValue={w?.people_served ?? ""} /></Field>
      <Field label="Water source type"><Input name="source_type" defaultValue={w?.source_type ?? ""} placeholder="Borehole with India Mark II hand pump" /></Field>
      <Field label="Depth (m)"><Input name="depth_m" type="number" step="0.1" defaultValue={w?.depth_m ?? ""} /></Field>
      <Field label="Yield (litres/hour)"><Input name="yield_lph" type="number" defaultValue={w?.yield_lph ?? ""} /></Field>
      <Field label="Target cost"><Input name="target_cost" type="number" step="0.01" defaultValue={w?.target_cost ?? ""} /></Field>
      <Field label="Currency"><Input name="currency" defaultValue={w?.currency ?? "AUD"} maxLength={3} /></Field>
      <Field label="Dedication" className="sm:col-span-2" hint="Optional. Shown on the funder's page and the certificate."><Input name="dedication" defaultValue={w?.dedication ?? ""} placeholder="In memory of…" /></Field>
      <Field label="About the community" className="sm:col-span-2"><Textarea name="summary" defaultValue={w?.summary ?? ""} placeholder="Two or three sentences a funder would want to read." /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="folder_is_public" defaultChecked={w ? w.folder_is_public : true} />
        Drive folder viewable by link (needed for video playback)
      </label>
      <div className="sm:col-span-2 flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : w ? "Save changes" : "Create well"}</Button>
        <Notice result={state} />
      </div>
    </form>
  );
}
