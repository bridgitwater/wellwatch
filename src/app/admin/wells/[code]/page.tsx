import Link from "next/link";
import { notFound } from "next/navigation";
import { addCost, addWaterTest, createNote, deleteCost, removeFunder, saveUpdate, setStage, toggleMediaHidden } from "@/lib/admin/actions";
import { FunderForm } from "@/components/admin/funder-form";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { WellForm } from "@/components/admin/well-form";
import { DriveImage } from "@/components/drive-image";
import { StagePill } from "@/components/stage-pill";
import { fmtDate, fmtMoney } from "@/lib/format";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import { COST_LABEL, type Cost, type StageRow, type WaterTest, type Well } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminWell({ params }: PageProps<"/admin/wells/[code]">) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: well } = await supabase.from("wells").select("*").eq("code", code).maybeSingle();
  if (!well) notFound();

  const [orgs, stages, funders, updates, costs, tests] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("type", "partner").order("name"),
    supabase.from("stages").select("stage, reached_at, expected_at, note").eq("well_id", well.id),
    supabase.from("well_funders").select("id, amount, currency, funded_at, is_primary, profiles(email, display_name)").eq("well_id", well.id).order("funded_at"),
    supabase.from("updates").select("id, body, stage, status, source, happened_at, media(id, drive_file_id, kind, name, hidden)").eq("well_id", well.id).order("happened_at", { ascending: false }),
    supabase.from("costs").select("id, category, amount, currency, note").eq("well_id", well.id),
    supabase.from("water_tests").select("*").eq("well_id", well.id).order("tested_at", { ascending: false }),
  ]);

  const stageBy = new Map(((stages.data ?? []) as StageRow[]).map((s) => [s.stage, s]));
  type FunderRow = { id: string; amount: string | null; currency: string; funded_at: string | null; is_primary: boolean; profiles: { email: string; display_name: string | null } | null };
  const funderRows = (funders.data ?? []) as unknown as FunderRow[];
  const w = well as Well & { exact_lat: number | null; exact_lng: number | null; partner_org_id: string | null };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <Link href="/admin/wells" className="text-sm text-ink-2 hover:text-ink">← Wells</Link>
          <h1 className="text-2xl font-bold flex items-center gap-3 mt-1">
            {w.name} <span className="font-mono text-sm text-ink-3 font-normal">{w.code}</span> <StagePill stage={w.status} />
          </h1>
        </div>
        <div className="flex gap-2 text-sm">
          {w.drive_folder_id ? (
            <a className="rounded-md border border-line px-3 py-2 hover:border-ink-3" href={`https://drive.google.com/drive/folders/${w.drive_folder_id}`} target="_blank" rel="noreferrer">Open Drive folder</a>
          ) : (
            <span className="rounded-md border border-dashed border-line px-3 py-2 text-ink-3">No Drive folder linked yet</span>
          )}
          <Link className="rounded-md bg-water text-white px-3 py-2 font-semibold hover:bg-water-deep" href={`/wells/${w.code}`}>View as funder</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6 min-w-0">
          {/* Stages */}
          <Card title="Stages">
            <div className="flex flex-col divide-y divide-line -my-3">
              {STAGE_ORDER.map((s) => {
                const row = stageBy.get(s);
                return (
                  <form key={s} action={setStage} className="py-3 grid gap-2 sm:grid-cols-[150px_140px_140px_1fr_auto] sm:items-end">
                    <input type="hidden" name="well_id" value={w.id} /><input type="hidden" name="code" value={w.code} /><input type="hidden" name="stage" value={s} />
                    <div className="font-semibold text-sm pb-2">{STAGE_LABEL[s]}</div>
                    <Field label="Reached"><Input type="date" name="reached_at" defaultValue={row?.reached_at ?? ""} /></Field>
                    <Field label="Expected"><Input type="date" name="expected_at" defaultValue={row?.expected_at ?? ""} /></Field>
                    <Field label="Note (shown to funders)"><Input name="note" defaultValue={row?.note ?? ""} /></Field>
                    <Button variant="ghost" type="submit">Save</Button>
                  </form>
                );
              })}
            </div>
          </Card>

          {/* Updates */}
          <Card title={`Updates (${updates.data?.length ?? 0})`}>
            <form action={createNote} className="mb-5 grid gap-2 sm:grid-cols-[1fr_160px_auto] sm:items-end">
              <input type="hidden" name="well_id" value={w.id} /><input type="hidden" name="code" value={w.code} />
              <Field label="Add a written update"><Textarea name="body" className="min-h-16" placeholder="A sentence or two for funders. Photos arrive from Drive separately." /></Field>
              <Field label="Stage"><Select name="stage" defaultValue={w.status}>{STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</Select></Field>
              <Button type="submit">Post</Button>
            </form>
            <ul className="flex flex-col gap-4">
              {(updates.data ?? []).map((u) => (
                <li key={u.id} className={`rounded-lg border border-line p-4 ${u.status === "hidden" ? "opacity-60" : ""}`}>
                  <form action={saveUpdate} className="grid gap-2 sm:grid-cols-[1fr_150px_120px_auto] sm:items-end">
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="code" value={w.code} />
                    <Field label={`${fmtDate(u.happened_at, { hour: "2-digit", minute: "2-digit" })} · ${u.source}`}>
                      <Textarea name="body" defaultValue={u.body ?? ""} className="min-h-14" placeholder="No note yet — add one for funders" />
                    </Field>
                    <Field label="Stage"><Select name="stage" defaultValue={u.stage ?? ""}><option value="">—</option>{STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</Select></Field>
                    <Field label="Visibility"><Select name="status" defaultValue={u.status}><option value="published">Published</option><option value="hidden">Hidden</option></Select></Field>
                    <Button variant="ghost" type="submit">Save</Button>
                  </form>
                  {u.media.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {u.media.map((m) => (
                        <li key={m.id} className={`relative ${m.hidden ? "opacity-40" : ""}`}>
                          {m.kind === "photo" ? (
                            <DriveImage fileId={m.drive_file_id} alt={m.name ?? ""} width={200} className="h-20 w-20 rounded object-cover" />
                          ) : (
                            <div className="h-20 w-20 rounded bg-aquifer text-xs flex items-center justify-center text-water-deep">{m.kind}</div>
                          )}
                          <form action={toggleMediaHidden} className="absolute bottom-1 right-1">
                            <input type="hidden" name="id" value={m.id} /><input type="hidden" name="code" value={w.code} /><input type="hidden" name="hide" value={m.hidden ? "0" : "1"} />
                            <button type="submit" className="rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5">{m.hidden ? "show" : "hide"}</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Details">
            <WellForm well={w} orgs={orgs.data ?? []} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title={`Funders (${funderRows.length})`}>
            {funderRows.length > 0 && (
              <ul className="mb-5 flex flex-col divide-y divide-line text-sm">
                {funderRows.map((f) => (
                  <li key={f.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{f.profiles?.display_name ?? f.profiles?.email}{f.is_primary && <span className="ml-1 text-xs text-ink-3">primary</span>}</div>
                      <div className="text-xs text-ink-2 truncate">{f.profiles?.email} · {fmtMoney(f.amount, f.currency)}{f.funded_at ? ` · ${fmtDate(f.funded_at)}` : ""}</div>
                    </div>
                    <form action={removeFunder}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="code" value={w.code} /><Button variant="danger" type="submit">Remove</Button></form>
                  </li>
                ))}
              </ul>
            )}
            <FunderForm wellId={w.id} code={w.code} currency={w.currency} />
          </Card>

          <Card title="Costs">
            <ul className="text-sm flex flex-col divide-y divide-line mb-4">
              {((costs.data ?? []) as (Cost & { id: string })[]).map((c) => (
                <li key={c.id} className="py-1.5 flex items-center justify-between gap-2">
                  <span>{COST_LABEL[c.category]}{c.note ? <span className="text-ink-3"> · {c.note}</span> : null}</span>
                  <span className="flex items-center gap-2"><span className="tnum">{fmtMoney(c.amount, c.currency)}</span>
                    <form action={deleteCost}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="code" value={w.code} /><button className="text-clay text-xs" type="submit">remove</button></form></span>
                </li>
              ))}
            </ul>
            <form action={addCost} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="well_id" value={w.id} /><input type="hidden" name="code" value={w.code} />
              <Field label="Category" className="col-span-2"><Select name="category">{Object.entries(COST_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Amount"><Input name="amount" type="number" step="0.01" required /></Field>
              <Field label="Currency"><Input name="currency" defaultValue={w.currency} maxLength={3} /></Field>
              <Field label="Note" className="col-span-2"><Input name="note" /></Field>
              <Button variant="ghost" type="submit" className="col-span-2">Add cost line</Button>
            </form>
          </Card>

          <Card title="Water tests">
            <ul className="text-sm flex flex-col divide-y divide-line mb-4">
              {((tests.data ?? []) as WaterTest[]).map((t) => (
                <li key={t.tested_at} className="py-1.5 flex justify-between">
                  <span>{fmtDate(t.tested_at)}{t.lab ? <span className="text-ink-3"> · {t.lab}</span> : null}</span>
                  <span className={t.passed ? "text-ok font-semibold" : "text-clay font-semibold"}>{t.passed ? "pass" : "fail"}</span>
                </li>
              ))}
            </ul>
            <form action={addWaterTest} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="well_id" value={w.id} /><input type="hidden" name="code" value={w.code} />
              <Field label="Date tested"><Input name="tested_at" type="date" required /></Field>
              <Field label="Lab"><Input name="lab" /></Field>
              <Field label="E. coli /100 ml"><Input name="e_coli_cfu" type="number" /></Field>
              <Field label="pH"><Input name="ph" type="number" step="0.01" /></Field>
              <Field label="Turbidity NTU"><Input name="turbidity_ntu" type="number" step="0.01" /></Field>
              <Field label="Fluoride mg/L"><Input name="fluoride_mgl" type="number" step="0.01" /></Field>
              <Field label="Arsenic µg/L"><Input name="arsenic_ugl" type="number" step="0.01" /></Field>
              <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" name="passed" defaultChecked /> Passed</label>
              <Button variant="ghost" type="submit" className="col-span-2">Add test</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
