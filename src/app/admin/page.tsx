import Link from "next/link";
import { toggleUpdateHidden } from "@/lib/admin/actions";
import { Button, Card } from "@/components/admin/ui";
import { DriveImage } from "@/components/drive-image";
import { fmtDate, fmtRelative } from "@/lib/format";
import { STAGE_LABEL, STAGE_ORDER, type WellStage } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();
  const since = new Date(new Date().getTime() - 3 * 24 * 3600 * 1000).toISOString();

  const [recent, wells, sync] = await Promise.all([
    supabase
      .from("updates")
      .select("id, body, stage, status, source, happened_at, created_at, wells(code, name), media(id, drive_file_id, kind, hidden)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("wells").select("status"),
    supabase.from("drive_sync_state").select("*").eq("id", 1).maybeSingle(),
  ]);

  const counts = new Map<WellStage, number>();
  for (const w of wells.data ?? []) counts.set(w.status as WellStage, (counts.get(w.status as WellStage) ?? 0) + 1);
  type Row = NonNullable<typeof recent.data>[number] & { wells: { code: string; name: string } | null };
  const rows = (recent.data ?? []) as unknown as Row[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <Card title="Posted in the last 3 days">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-2">Nothing new. Drop photos into a well&apos;s Drive folder and they&apos;ll appear here within ten minutes.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line -my-2">
              {rows.map((u) => (
                <li key={u.id} className="py-3 flex gap-4">
                  <div className="flex gap-1 shrink-0">
                    {u.media.filter((m) => m.kind === "photo" && !m.hidden).slice(0, 3).map((m) => (
                      <DriveImage key={m.id} fileId={m.drive_file_id} alt="" width={200} className="h-14 w-14 rounded object-cover" />
                    ))}
                    {u.media.length === 0 && <div className="h-14 w-14 rounded bg-aquifer" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <Link href={`/admin/wells/${u.wells?.code}`} className="font-semibold hover:text-water">{u.wells?.name}</Link>
                      <span className="text-ink-3 font-mono text-xs">{u.wells?.code}</span>
                      <span className="text-ink-3">· {fmtRelative(u.created_at)} · {u.media.length} file{u.media.length === 1 ? "" : "s"} · {u.source}</span>
                      {u.status === "hidden" && <span className="text-xs font-semibold text-clay">hidden</span>}
                    </div>
                    <p className="text-sm text-ink-2 truncate">{u.body ?? <span className="italic text-ink-3">no note yet</span>}</p>
                  </div>
                  <form action={toggleUpdateHidden} className="shrink-0">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="code" value={u.wells?.code ?? ""} />
                    <input type="hidden" name="hide" value={u.status === "hidden" ? "0" : "1"} />
                    <Button variant={u.status === "hidden" ? "ghost" : "danger"} type="submit">
                      {u.status === "hidden" ? "Unhide" : "Hide"}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card title="Wells by stage">
          <ul className="flex flex-col gap-1.5 text-sm">
            {STAGE_ORDER.map((s) => (
              <li key={s} className="flex justify-between">
                <span>{STAGE_LABEL[s]}</span>
                <span className="tnum font-semibold">{counts.get(s) ?? 0}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-line pt-1.5 mt-1 font-semibold">
              <span>Total</span><span className="tnum">{wells.data?.length ?? 0}</span>
            </li>
          </ul>
        </Card>
        <Card title="Drive sync">
          <dl className="text-sm flex flex-col gap-1">
            <div className="flex justify-between"><dt className="text-ink-2">Last run</dt><dd>{sync.data?.last_synced_at ? fmtRelative(sync.data.last_synced_at) : "never"}</dd></div>
            {sync.data?.last_error && (
              <div><dt className="text-ink-2">Last error</dt><dd className="text-clay text-xs break-words">{sync.data.last_error}</dd></div>
            )}
          </dl>
          <p className="text-xs text-ink-3 mt-3">Runs every 10 minutes. {sync.data?.last_synced_at ? `Last: ${fmtDate(sync.data.last_synced_at, { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        </Card>
      </div>
    </div>
  );
}
