import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { BulkWelcomeForm, type PendingFunder } from "@/components/admin/bulk-welcome-form";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcomes" };

type Row = {
  welcomed_at: string | null;
  profiles: { id: string; email: string; display_name: string | null; notify_email: boolean } | null;
  wells: { code: string; name: string } | null;
};

export default async function WelcomesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("well_funders")
    .select("welcomed_at, profiles(id, email, display_name, notify_email), wells(code, name)")
    .order("welcomed_at", { ascending: false, nullsFirst: true });
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.profiles && r.wells);

  const pending = new Map<string, PendingFunder>();
  for (const r of rows.filter((r) => !r.welcomed_at)) {
    const p = r.profiles!;
    const f = pending.get(p.id) ?? { id: p.id, email: p.email, name: p.display_name, notifyEmail: p.notify_email, wells: [] };
    f.wells.push({ code: r.wells!.code, name: r.wells!.name });
    pending.set(p.id, f);
  }
  const recent = rows.filter((r) => r.welcomed_at).slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Welcomes</h1>
        <p className="text-sm text-ink-2 mt-1 max-w-2xl">
          Funders linked to a well get nothing from WellWatch until they&apos;re welcomed. The welcome email thanks them,
          lists their wells and signs them in; after that they get update emails. Preview an email before you send it.
        </p>
      </div>
      {error && <p className="rounded-lg bg-clay-soft text-clay px-4 py-3 text-sm">Couldn&apos;t load funders: {error.message}</p>}
      {pending.size === 0 ? (
        <Card title="Waiting for a welcome">
          <p className="text-sm text-ink-2">Nobody. Link funders on a <Link href="/admin/wells" className="underline">well&apos;s page</Link> or with an <Link href="/admin/import" className="underline">import</Link>, and they&apos;ll appear here.</p>
        </Card>
      ) : (
        <BulkWelcomeForm funders={[...pending.values()]} />
      )}
      {recent.length > 0 && (
        <Card title="Recently welcomed">
          <ul className="flex flex-col divide-y divide-line text-sm -my-2">
            {recent.map((r, i) => (
              <li key={i} className="py-2 flex flex-wrap justify-between gap-2">
                <span><span className="font-medium">{r.profiles!.display_name ?? r.profiles!.email}</span> <span className="text-ink-3">· {r.wells!.name} ({r.wells!.code})</span></span>
                <span className="text-ink-2 text-xs">{fmtDate(r.welcomed_at!)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
