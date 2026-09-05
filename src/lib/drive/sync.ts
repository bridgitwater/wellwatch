import { createAdminClient, errorMessage, selectAll } from "../supabase/admin";
import { listAllInDrive, sharedDriveId } from "./client";
import { planSync, type DbMedia, type DbUpdate, type DbWell, type SyncPlan } from "./plan";

export type SyncResult = {
  ok: boolean;
  linked: number;
  newUpdates: number;
  newMedia: number;
  renamed: number;
  deleted: number;
  unmatchedFolders: string[];
  error?: string;
};

/** Reads the whole Wells drive, diffs it against the database, and applies the changes. */
export async function runDriveSync(): Promise<SyncResult> {
  const db = createAdminClient();
  try {
    // Paged reads (PostgREST caps a single select at 1,000 rows; past that the
    // planner would re-insert existing media and trip the unique constraint).
    // Each page retries 3x with backoff.
    const [files, wells, media, updates] = await Promise.all([
      listAllInDrive(),
      selectAll<DbWell>("read wells", () =>
        db.from("wells").select("id, code, drive_folder_id, stages(stage, reached_at)"),
      ),
      selectAll<DbMedia>("read media", () =>
        db.from("media").select("id, update_id, well_id, drive_file_id, name, drive_modified_at"),
      ),
      selectAll<DbUpdate>("read updates", () => db.from("updates").select("id, well_id, source, happened_at")),
    ]);

    const plan = planSync(sharedDriveId(), files, wells, media, updates);

    const counts = await applyPlan(db, plan);

    await db
      .from("drive_sync_state")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", 1);

    return { ok: true, ...counts, unmatchedFolders: plan.unmatchedFolders.map((f) => f.name) };
  } catch (e) {
    const msg = errorMessage(e);
    console.error("drive-sync failed:", msg);
    await db.from("drive_sync_state").update({ last_error: msg }).eq("id", 1);
    return { ok: false, linked: 0, newUpdates: 0, newMedia: 0, renamed: 0, deleted: 0, unmatchedFolders: [], error: msg };
  }
}

async function applyPlan(db: ReturnType<typeof createAdminClient>, plan: SyncPlan) {
  let newMedia = 0;

  for (const l of plan.linkFolders) {
    const { error } = await db.from("wells").update({ drive_folder_id: l.drive_folder_id }).eq("id", l.well_id);
    if (error) throw error;
  }

  for (const u of plan.newUpdates) {
    const { data, error } = await db
      .from("updates")
      .insert({ well_id: u.well_id, source: "drive", stage: u.stage, happened_at: u.happened_at })
      .select("id")
      .single();
    if (error) throw error;
    const rows = u.media.map((m) => ({ ...m, update_id: data.id }));
    const ins = await db.from("media").insert(rows);
    if (ins.error) throw ins.error;
    newMedia += rows.length;
  }

  if (plan.attachToExisting.length) {
    const rows = plan.attachToExisting.map((a) => ({ ...a.media, update_id: a.update_id }));
    const { error } = await db.from("media").insert(rows);
    if (error) throw error;
    newMedia += rows.length;
  }

  for (const r of plan.renamed) {
    const { error } = await db
      .from("media")
      .update({ name: r.name, drive_modified_at: r.drive_modified_at })
      .eq("id", r.id);
    if (error) throw error;
  }

  if (plan.deleteMediaIds.length) {
    const { error } = await db.from("media").delete().in("id", plan.deleteMediaIds);
    if (error) throw error;
    // Drive-sourced updates left with no media and no text are noise; remove them.
    const { error: e2 } = await db.rpc("prune_empty_drive_updates");
    if (e2) throw e2;
  }

  return {
    linked: plan.linkFolders.length,
    newUpdates: plan.newUpdates.length,
    newMedia,
    renamed: plan.renamed.length,
    deleted: plan.deleteMediaIds.length,
  };
}
