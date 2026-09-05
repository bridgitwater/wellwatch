import Link from "next/link";
import { Button } from "@/components/admin/ui";
import { StagePill } from "@/components/stage-pill";
import { countryName, fmtInt, fmtRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { WellStage } from "@/lib/stages";

export const dynamic = "force-dynamic";

export default async function AdminWells({ searchParams }: PageProps<"/admin/wells">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();

  let query = supabase
    .from("wells")
    .select("id, code, name, country, region, status, people_served, drive_folder_id, updated_at, well_funders(count), organizations(name)")
    .order("code", { ascending: false })
    .limit(300);
  if (q) query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%,region.ilike.%${q}%`);
  const { data } = await query;

  type Row = { id: string; code: string; name: string; country: string; region: string | null; status: WellStage; people_served: number | null;
    drive_folder_id: string | null; updated_at: string; well_funders: { count: number }[]; organizations: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Wells</h1>
        <div className="flex gap-2">
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search code, name, region" className="rounded-md border border-line bg-surface px-3 py-2 text-sm w-64" />
            <Button variant="ghost" type="submit">Search</Button>
          </form>
          <Link href="/admin/wells/new" className="rounded-md bg-water text-white px-3 py-2 text-sm font-semibold hover:bg-water-deep">New well</Link>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 border-b border-line">
              <th>Code</th><th>Community</th><th>Country</th><th>Partner</th><th>Stage</th>
              <th className="text-right">People</th><th className="text-right">Funders</th><th>Drive</th><th>Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((w) => (
              <tr key={w.id} className="[&>td]:px-4 [&>td]:py-2.5 hover:bg-bg">
                <td className="font-mono text-xs"><Link href={`/admin/wells/${w.code}`} className="hover:text-water">{w.code}</Link></td>
                <td className="font-semibold"><Link href={`/admin/wells/${w.code}`} className="hover:text-water">{w.name}</Link><div className="text-xs text-ink-3 font-normal">{w.region}</div></td>
                <td>{countryName(w.country)}</td>
                <td className="text-ink-2">{w.organizations?.name ?? "—"}</td>
                <td><StagePill stage={w.status} /></td>
                <td className="text-right tnum">{fmtInt(w.people_served)}</td>
                <td className="text-right tnum">{w.well_funders[0]?.count ?? 0}</td>
                <td>{w.drive_folder_id ? <span className="text-ok text-xs font-semibold">linked</span> : <span className="text-ink-3 text-xs">no folder</span>}</td>
                <td className="text-ink-2 whitespace-nowrap">{fmtRelative(w.updated_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-ink-2">No wells{q ? ` matching “${q}”` : " yet"}. <Link href="/admin/import" className="underline">Import a CSV</Link> or create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
