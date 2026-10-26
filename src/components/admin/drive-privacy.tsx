import { createAdminClient } from "@/lib/supabase/admin";
import { DrivePrivacyButtons } from "./drive-privacy-buttons";
import { Card } from "./ui";

/**
 * Progress of private Drive folders (src/lib/drive/shares.ts): how many of the files
 * funders can see have a confirmed link of their own, and how many well folders are
 * private. The button makes the remaining folders private once files are ready.
 * Server component, rendered only inside the admin layout.
 */
export async function DrivePrivacyCard() {
  const db = createAdminClient();
  const [d, rows, wells] = await Promise.all([
    db.rpc("desired_drive_shares"),
    db.from("drive_shares").select("file_id, kind, shared, direct, last_error"),
    db.from("wells").select("drive_folder_id").not("drive_folder_id", "is", null),
  ]);
  if (d.error || rows.error || wells.error) {
    return <Card title="Drive privacy"><p className="text-sm text-clay">Couldn&apos;t check Drive privacy: {(d.error ?? rows.error ?? wells.error)?.message}</p></Card>;
  }
  const byId = new Map((rows.data ?? []).map((r) => [r.file_id, r]));
  const desired = (d.data ?? []) as { file_id: string }[];
  const verified = desired.filter((x) => byId.get(x.file_id)?.direct).length;
  const failing = desired.filter((x) => byId.get(x.file_id)?.last_error && !byId.get(x.file_id)?.direct).length;
  const folders = new Set((wells.data ?? []).map((w) => w.drive_folder_id as string));
  const privateFolders = [...folders].filter((f) => byId.get(f)?.kind === "folder" && byId.get(f)?.shared === false).length;
  const ready = desired.length > 0 && verified === desired.length;
  const done = folders.size > 0 && privateFolders === folders.size;

  return (
    <Card title="Drive privacy">
      <dl className="text-sm flex flex-col gap-1">
        <div className="flex justify-between"><dt className="text-ink-2">Files funders see, shared on their own</dt><dd className="tnum font-semibold">{verified} / {desired.length}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">Well folders private</dt><dd className="tnum font-semibold">{privateFolders} / {folders.size}</dd></div>
      </dl>
      {failing > 0 && <p className="text-xs text-clay mt-2">{failing} file{failing === 1 ? "" : "s"} couldn&apos;t be shared yet; WellWatch retries every 10 minutes.</p>}
      {done ? (
        <p className="text-xs text-ok mt-3">Done. Folders are private: only the photos, videos and reports funders can see have links, and hiding one removes its link.</p>
      ) : (
        <>
          <p className="text-xs text-ink-3 mt-3">
            {ready
              ? "Every file funders can see has its own link, so the folders can now be made private. Hidden photos will then be unreachable from Drive."
              : "Files are being shared one by one by the 10-minute sync. Once they all are, make the folders private. Until then, anyone with a folder's link can browse it."}
          </p>
          <DrivePrivacyButtons ready={ready} />
        </>
      )}
    </Card>
  );
}
