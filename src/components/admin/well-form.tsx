"use client";

import { useActionState } from "react";
import { createWell, updateWell, type ActionResult } from "@/lib/admin/actions";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";
import { COUNTRY_NAME } from "@/lib/format";
import { WELL_TYPE_LABEL, type Well } from "@/lib/types";

type Org = { id: string; name: string };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="sm:col-span-2 grid gap-4 sm:grid-cols-2 border-t border-line pt-4 mt-2">
      <legend className="text-sm font-bold pr-3">{title}</legend>
      {hint && <p className="sm:col-span-2 text-xs text-ink-3 -mt-2">{hint}</p>}
      {children}
    </fieldset>
  );
}

export function WellForm({ well, orgs }: { well?: Well & { exact_lat?: number | null; exact_lng?: number | null }; orgs: Org[] }) {
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
      <Field label="Project type">
        <Select name="well_type" defaultValue={w?.well_type ?? "drilled"}>
          {Object.entries(WELL_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Partner organization">
        <Select name="partner_org_id" defaultValue={w?.partner_org_id ?? ""}>
          <option value="">—</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </Field>
      <Field label="Country">
        <Select name="country" defaultValue={w?.country ?? "UG"} required>
          {Object.entries(COUNTRY_NAME).filter(([c]) => c !== "AU").map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </Select>
      </Field>
      <Field label="Region / district"><Input name="region" defaultValue={w?.region ?? ""} placeholder="Kayunga District" /></Field>
      <Field label="Village"><Input name="village" defaultValue={w?.village ?? ""} /></Field>
      <Field label="Program name" hint="As on the report cover, e.g. “2026 Hand Drilled & Refurbished Borewell Program”."><Input name="program_name" defaultValue={w?.program_name ?? ""} /></Field>
      <Field label="Sponsored by" hint="Shown to funders exactly as written, e.g. “the Kent Family, Australia”."><Input name="sponsor_line" defaultValue={w?.sponsor_line ?? ""} /></Field>
      <Field label="Dedication" hint="Optional. Shown on the funder's page and the certificate."><Input name="dedication" defaultValue={w?.dedication ?? ""} placeholder="In memory of…" /></Field>

      <Section title="Beneficiaries" hint="Reports count 6 people per household. Distances feed the headline numbers on the funder page.">
        <Field label="Households"><Input name="households" type="number" defaultValue={w?.households ?? ""} /></Field>
        <Field label="People served"><Input name="people_served" type="number" defaultValue={w?.people_served ?? ""} /></Field>
        <Field label="Walk to water before (km)"><Input name="before_distance_km" type="number" step="0.1" defaultValue={w?.before_distance_km ?? ""} placeholder="3.5" /></Field>
        <Field label="Walk to water after (m)"><Input name="after_distance_m" type="number" defaultValue={w?.after_distance_m ?? ""} placeholder="300" /></Field>
        <Field label="Hours saved per day"><Input name="hours_saved_day" type="number" step="0.5" defaultValue={w?.hours_saved_day ?? ""} placeholder="2" /></Field>
        <Field label="About the community" className="sm:col-span-2"><Textarea name="summary" defaultValue={w?.summary ?? ""} placeholder="Two or three sentences a funder would want to read." /></Field>
        <Field label="Background — before the well" className="sm:col-span-2" hint="The report's Background section: previous source, how far, quality, who collected it, the hardship."><Textarea name="before_story" defaultValue={w?.before_story ?? ""} className="min-h-32" /></Field>
      </Section>

      <Section title="Location">
        <Field label="Approximate latitude" hint="Village centre — shown to funders."><Input name="approx_lat" type="number" step="any" defaultValue={w?.approx_lat ?? ""} /></Field>
        <Field label="Approximate longitude"><Input name="approx_lng" type="number" step="any" defaultValue={w?.approx_lng ?? ""} /></Field>
        <Field label="Exact latitude" hint="Pump GPS — admins and partners only."><Input name="exact_lat" type="number" step="any" defaultValue={w?.exact_lat ?? ""} /></Field>
        <Field label="Exact longitude"><Input name="exact_lng" type="number" step="any" defaultValue={w?.exact_lng ?? ""} /></Field>
        <Field label="GPS as reported" className="sm:col-span-2" hint="Copied from the partner's report, any format, e.g. N 1.0669, E 32.8834."><Input name="gps_text" defaultValue={w?.gps_text ?? ""} /></Field>
      </Section>

      <Section title="Technical">
        <Field label="Pump type"><Input name="pump_type" defaultValue={w?.pump_type ?? ""} placeholder="India Mark II" /></Field>
        <Field label="Contractor / driller"><Input name="contractor" defaultValue={w?.contractor ?? ""} /></Field>
        <Field label="Depth (m)"><Input name="depth_m" type="number" step="0.1" defaultValue={w?.depth_m ?? ""} /></Field>
        <Field label="Yield (litres/hour)"><Input name="yield_lph" type="number" defaultValue={w?.yield_lph ?? ""} /></Field>
        <Field label="Water source description" className="sm:col-span-2"><Input name="source_type" defaultValue={w?.source_type ?? ""} placeholder="Borehole with India Mark II hand pump" /></Field>
      </Section>

      <Section title="Impact & sustainability" hint="Appears once filled in — usually at completion, straight from the report.">
        <Field label="Project impacts" className="sm:col-span-2" hint="One per line."><Textarea name="impacts" defaultValue={w?.impacts ?? ""} className="min-h-32" placeholder={"Walk to clean water cut from 3–4 km to 300 m\nWomen save around 2 hours a day\n126 children now attend school regularly"} /></Field>
        <Field label="WUC members"><Input name="wuc_members" type="number" defaultValue={w?.wuc_members ?? ""} placeholder="8" /></Field>
        <Field label="…of whom women"><Input name="wuc_women" type="number" defaultValue={w?.wuc_women ?? ""} placeholder="3" /></Field>
        <Field label="…youth"><Input name="wuc_youth" type="number" defaultValue={w?.wuc_youth ?? ""} placeholder="2" /></Field>
        <Field label="…people with disabilities"><Input name="wuc_pwd" type="number" defaultValue={w?.wuc_pwd ?? ""} placeholder="1" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="wuc_treasurer_woman" defaultChecked={w?.wuc_treasurer_woman ?? false} /> Treasurer is a woman
        </label>
        <Field label="Training" className="sm:col-span-2" hint="WUC and WASH training: what, who to, by whom, user fees."><Textarea name="training_note" defaultValue={w?.training_note ?? ""} /></Field>
        <Field label="Sustainability" className="sm:col-span-2"><Textarea name="sustainability" defaultValue={w?.sustainability ?? ""} /></Field>
        <Field label="Challenges" className="sm:col-span-2"><Textarea name="challenges" defaultValue={w?.challenges ?? ""} /></Field>
        <Field label="Lessons learned" className="sm:col-span-2"><Textarea name="lessons" defaultValue={w?.lessons ?? ""} /></Field>
      </Section>

      <Section title="Completion">
        <Field label="Completed on"><Input name="completed_at" type="date" defaultValue={w?.completed_at ?? ""} /></Field>
        <Field label="Completion report" hint="Drive link or file id of the final PDF. Funders get a “Read the completion report” button."><Input name="report_file_id" defaultValue={w?.report_file_id ?? ""} placeholder="https://drive.google.com/file/d/…" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="plaque_installed" defaultChecked={w?.plaque_installed ?? false} /> Acknowledgement plaque installed on the pump head
        </label>
      </Section>

      <Section title="Money & files">
        <Field label="Target cost"><Input name="target_cost" type="number" step="0.01" defaultValue={w?.target_cost ?? ""} /></Field>
        <Field label="Currency"><Input name="currency" defaultValue={w?.currency ?? "AUD"} maxLength={3} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="folder_is_public" defaultChecked={w ? w.folder_is_public : true} />
          Drive folder viewable by link (needed for video playback)
        </label>
      </Section>

      <div className="sm:col-span-2 flex items-center gap-4 sticky bottom-0 bg-surface py-3 border-t border-line">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : w ? "Save changes" : "Create well"}</Button>
        <Notice result={state} />
      </div>
    </form>
  );
}
