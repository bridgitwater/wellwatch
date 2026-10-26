"use client";

import { useState } from "react";
import { sendBulkWelcomes } from "@/lib/admin/actions";
import { ActionForm } from "./action-form";
import { Button } from "./ui";

export type PendingFunder = {
  id: string;
  email: string;
  name: string | null;
  notifyEmail: boolean;
  wells: { code: string; name: string }[];
};

/** Tick funders and send their welcomes in one go; each funder gets one email covering all their wells. */
export function BulkWelcomeForm({ funders }: { funders: PendingFunder[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Funders welcomed a moment ago drop off the list; only count the ones still shown.
  const live = funders.filter((f) => picked.has(f.id)).length;
  const all = live === Math.min(funders.length, 25) && funders.length > 0;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <ActionForm
      action={sendBulkWelcomes}
      confirm={(fd) => {
        const n = fd.getAll("funder").length;
        if (!n) return null;
        return `Send welcome emails to ${n} funder${n === 1 ? "" : "s"}?\n\nEach gets one email with a sign-in link covering all of their wells, and from then on they get update emails.`;
      }}
      className="flex flex-col gap-3"
    >
      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 border-b border-line">
              <th className="w-8">
                <input type="checkbox" aria-label="Select all (up to 25)" checked={all} onChange={() => setPicked(all ? new Set() : new Set(funders.slice(0, 25).map((f) => f.id)))} />
              </th>
              <th>Funder</th><th>Wells waiting for a welcome</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {funders.map((f) => (
              <tr key={f.id} className="[&>td]:px-4 [&>td]:py-2.5 align-top">
                <td><input type="checkbox" name="funder" value={f.id} checked={picked.has(f.id)} onChange={() => toggle(f.id)} aria-label={`Select ${f.email}`} /></td>
                <td>
                  <div className="font-semibold">{f.name ?? f.email}</div>
                  <div className="text-xs text-ink-2">{f.email}{!f.notifyEmail && " · has update emails turned off"}</div>
                </td>
                <td className="text-ink-2">{f.wells.map((w) => `${w.name} (${w.code})`).join(", ")}</td>
                <td className="whitespace-nowrap">
                  <a className="text-water font-semibold underline" href={`/admin/welcomes/preview?funder=${f.id}`} target="_blank" rel="noreferrer">Preview email</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!live}>
          {live ? `Send ${live} welcome email${live === 1 ? "" : "s"}` : "Tick funders to welcome"}
        </Button>
        <span className="text-xs text-ink-3">Up to 25 at a time. A funder with several wells gets one email listing them all.</span>
      </div>
    </ActionForm>
  );
}
