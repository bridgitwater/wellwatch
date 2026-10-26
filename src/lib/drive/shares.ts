import "server-only";
import { errorMessage, type createAdminClient } from "../supabase/admin";
import { FOLDER_MIME, getDrive, type DriveFile } from "./client";

/**
 * Private Drive folders.
 *
 * Drive won't give a file a link of its own while its folder already shares the same link
 * (found in production, 27 Oct 2026), so it happens folder by folder:
 *
 * - An admin presses "Make folders private" (or "Try one folder first") on the dashboard.
 *   For each well folder: the folder's link is removed, each file funders may see gets its
 *   own "anyone with the link" (reader) permission and Drive confirms it; if any file can't
 *   be confirmed, the folder's link is put straight back. A few seconds per folder.
 * - Every Drive sync then keeps it that way: new files in private folders get their own
 *   link (confirmed), anything hidden or unused loses its own link, and a private folder
 *   that someone shares again by hand is made private again. Files in folders that are
 *   still shared are left alone: their folder's link already covers them.
 *
 * Drive is the source of truth: the listing's hasAugmentedPermissions says which items
 * have permissions of their own, so files shared outside WellWatch are caught too.
 */

type Db = ReturnType<typeof createAdminClient>;
export type Desired = { file_id: string; kind: string; folder_id: string | null };
export type ShareRow = { file_id: string; kind: string; shared: boolean; direct: boolean; last_error: string | null; updated_at: string };

/** The Drive calls this needs, separated out so the logic can be tested without Drive. */
export type DriveOps = {
  share(fileId: string): Promise<void>;
  /** True if the item has an "anyone with the link" permission of its own (not only inherited). */
  directLink(fileId: string): Promise<boolean>;
  /** Removes the item's own "anyone" permissions. Inherited ones are left (they can't be removed on a child). */
  unshare(fileId: string): Promise<void>;
};

async function listPermissions(fileId: string) {
  const drive = getDrive();
  const out: { id?: string | null; type?: string | null; permissionDetails?: { inherited?: boolean | null }[] | null }[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await drive.permissions.list({
      fileId, supportsAllDrives: true, pageSize: 100, pageToken,
      fields: "nextPageToken, permissions(id, type, permissionDetails(inherited))",
    });
    out.push(...(data.permissions ?? []));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

// Outside shared drives there are no permissionDetails: every permission is the item's own.
const isOwn = (p: { permissionDetails?: { inherited?: boolean | null }[] | null }) =>
  !p.permissionDetails?.length || p.permissionDetails.some((d) => d.inherited === false);

export const driveOps: DriveOps = {
  async share(fileId) {
    await getDrive().permissions.create({
      fileId, supportsAllDrives: true,
      requestBody: { type: "anyone", role: "reader", allowFileDiscovery: false },
    });
  },
  async directLink(fileId) {
    return (await listPermissions(fileId)).some((p) => p.type === "anyone" && isOwn(p));
  },
  async unshare(fileId) {
    const drive = getDrive();
    for (const p of await listPermissions(fileId)) {
      if (p.type === "anyone" && p.id && isOwn(p)) await drive.permissions.delete({ fileId, permissionId: p.id, supportsAllDrives: true });
    }
  },
};

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 && process.env.DRIVE_SHARED_DRIVE_ID);
}

const notFound = (e: unknown) => /not ?found|404/i.test(errorMessage(e));
const DAY = 24 * 3600 * 1000;

export type ShareResult = {
  shared: number; unshared: number; refolded: number;
  /** Files funders may see, and how many have a confirmed link of their own. */
  wanted: number; verified: number;
  errors: string[]; more: boolean;
};

type Ctx = { db: Db; ops: DriveOps; deadline: number; result: ShareResult; rows: Map<string, ShareRow> };

async function record(ctx: Ctx, file_id: string, kind: string, shared: boolean, direct: boolean, last_error: string | null) {
  const row = { file_id, kind, shared, direct, last_error, updated_at: new Date().toISOString() };
  const { error } = await ctx.db.from("drive_shares").upsert(row);
  if (error) ctx.result.errors.push(`record ${file_id}: ${errorMessage(error)}`);
  else ctx.rows.set(file_id, row);
}

/** Gives a file its own link, then has Drive confirm it. Records the outcome either way. */
async function shareVerified(ctx: Ctx, f: Desired, kind: string) {
  // Recorded first, so a crash between Drive and the database still leaves a trace to clean up.
  await record(ctx, f.file_id, kind, true, false, "sharing");
  try {
    await ctx.ops.share(f.file_id);
    if (!(await ctx.ops.directLink(f.file_id))) throw new Error("Drive didn't confirm the file's own link");
    await record(ctx, f.file_id, kind, true, true, null);
    ctx.result.shared++;
  } catch (e) {
    await record(ctx, f.file_id, kind, true, false, errorMessage(e).slice(0, 300));
    ctx.result.errors.push(`share ${kind} ${f.file_id}: ${errorMessage(e)}`);
  }
}

async function unshareOne(ctx: Ctx, fileId: string, kind: string) {
  try {
    await ctx.ops.unshare(fileId);
    await record(ctx, fileId, kind, false, false, null);
    ctx.result.unshared++;
  } catch (e) {
    if (notFound(e)) {
      const { error } = await ctx.db.from("drive_shares").delete().eq("file_id", fileId);
      if (error) ctx.result.errors.push(`record ${fileId}: ${errorMessage(error)}`);
      return;
    }
    await record(ctx, fileId, kind, false, false, errorMessage(e).slice(0, 300));
    ctx.result.errors.push(`unshare ${fileId}: ${errorMessage(e)}`);
  }
}

async function load(db: Db) {
  const [d, c] = await Promise.all([
    db.rpc("desired_drive_shares"),
    db.from("drive_shares").select("file_id, kind, shared, direct, last_error, updated_at"),
  ]);
  const err = d.error ?? c.error;
  if (err) throw err;
  return { desired: (d.data ?? []) as Desired[], rows: new Map(((c.data ?? []) as ShareRow[]).map((r) => [r.file_id, r])) };
}

const empty = (): ShareResult => ({ shared: 0, unshared: 0, refolded: 0, wanted: 0, verified: 0, errors: [], more: false });

/**
 * Phase 1, run by every Drive sync with the full Drive listing. Never throws; problems
 * come back in `errors` and are retried next run. Stops at `deadline` (ms since epoch),
 * doing the most urgent work first: files in folders that are already private.
 */
export async function reconcileShares(db: Db, files: DriveFile[], rootId: string, ops: DriveOps = driveOps, deadline = Date.now() + 150_000): Promise<ShareResult> {
  const result = empty();
  let loaded;
  try { loaded = await load(db); } catch (e) { return { ...result, errors: [`load: ${errorMessage(e)}`] }; }
  const ctx: Ctx = { db, ops, deadline, result, rows: loaded.rows };
  const { desired } = loaded;
  const wanted = new Set(desired.map((d) => d.file_id));
  const byId = new Map(files.map((f) => [f.id, f]));
  const privateFolder = (id: string | null | undefined) => !!id && ctx.rows.get(id)?.kind === "folder" && ctx.rows.get(id)?.shared === false;
  const topOf = topFolderOf(files, rootId);

  // Share: files in private folders without a confirmed link of their own (Drive's own flag
  // catches links removed outside WellWatch). Files in folders still shared are covered by
  // the folder's link and Drive won't give them their own, so they wait for that folder.
  const todo = desired.filter((d) => {
    const row = ctx.rows.get(d.file_id);
    const inDrive = byId.get(d.file_id);
    if (!inDrive) {
      // Not in the Wells drive (e.g. a report kept in someone's My Drive): try once a day.
      return !row?.direct && !(row && Date.now() - Date.parse(row.updated_at) < DAY);
    }
    if (!privateFolder(topOf(d.file_id))) return false;
    return !row?.direct || inDrive.augmented === false;
  });
  for (const f of todo) {
    if (Date.now() > ctx.deadline) { result.more = true; break; }
    await shareVerified(ctx, f, byId.has(f.file_id) ? f.kind : "other");
  }

  // Unshare: anything with a link of its own that funders shouldn't see, whether WellWatch
  // shared it or someone did by hand. Well folders are phase 2's job, not this.
  const wellFolders = new Set(files.filter((f) => f.mimeType === FOLDER_MIME && f.parents.includes(rootId)).map((f) => f.id));
  const candidates = new Set<string>();
  for (const r of ctx.rows.values()) if (r.kind !== "folder" && r.shared && !wanted.has(r.file_id)) candidates.add(r.file_id);
  for (const f of files) {
    if (!f.augmented || wanted.has(f.id) || wellFolders.has(f.id)) continue;
    const row = ctx.rows.get(f.id);
    // Already checked recently and found nothing of ours to remove (e.g. shared with a person).
    if (row && !row.shared && !row.last_error && Date.now() - Date.parse(row.updated_at) < DAY) continue;
    candidates.add(f.id);
  }
  for (const id of candidates) {
    if (Date.now() > ctx.deadline) { result.more = true; break; }
    await unshareOne(ctx, id, ctx.rows.get(id)?.kind === "folder" ? "folder" : byId.get(id)?.mimeType === FOLDER_MIME ? "other" : (ctx.rows.get(id)?.kind ?? "other"));
  }

  // Folders made private in phase 2 stay private: if someone shares one by link again, undo it.
  for (const r of [...ctx.rows.values()].filter((r) => r.kind === "folder" && !r.shared)) {
    const f = byId.get(r.file_id);
    if (!f || f.augmented === false || Date.now() > ctx.deadline) continue;
    try {
      if (await ops.directLink(r.file_id)) {
        await ops.unshare(r.file_id);
        result.refolded++;
        result.errors.push(`Folder "${f.name}" had been shared by link again; WellWatch made it private.`);
      }
    } catch (e) { result.errors.push(`folder ${f.name}: ${errorMessage(e)}`); }
  }

  result.wanted = desired.length;
  result.verified = desired.filter((d) => ctx.rows.get(d.file_id)?.direct).length;
  return result;
}

/** Maps a Drive item to the top-level (well) folder it sits in, from the sync's listing. */
function topFolderOf(files: DriveFile[], rootId: string) {
  const byId = new Map(files.map((f) => [f.id, f]));
  const parentOf = new Map(files.filter((f) => f.mimeType === FOLDER_MIME).map((f) => [f.id, f.parents[0]]));
  return (id: string): string | null => {
    let cur = byId.get(id)?.parents[0];
    for (let i = 0; cur && i < 20; i++) {
      const p = parentOf.get(cur);
      if (!p || p === rootId) return cur;
      cur = p;
    }
    return cur ?? null;
  };
}

/**
 * After an admin hides or shows something: share or unshare just those files now.
 * Returns a note for the admin when the change isn't fully effective yet.
 */
export async function applyShares(db: Db, fileIds: string[], ops: DriveOps = driveOps): Promise<string | null> {
  const result = empty();
  let loaded;
  try { loaded = await load(db); } catch { return "Saved. Drive hasn't caught up yet; WellWatch will retry within 10 minutes."; }
  const ctx: Ctx = { db, ops, deadline: Date.now() + 20_000, result, rows: loaded.rows };
  const want = new Map(loaded.desired.map((d) => [d.file_id, d]));
  let folderStillShared = false;
  const isPrivate = (folder: string | null) => !!folder && ctx.rows.get(folder)?.kind === "folder" && ctx.rows.get(folder)?.shared === false;
  for (const id of new Set(fileIds)) {
    const d = want.get(id);
    if (d) {
      // In a folder still shared by link, the folder already makes it viewable.
      if (isPrivate(d.folder_id) || d.kind === "logo") await shareVerified(ctx, d, d.kind);
    } else {
      await unshareOne(ctx, id, ctx.rows.get(id)?.kind ?? "media");
      const { data } = await db.from("media").select("wells(drive_folder_id)").eq("drive_file_id", id).maybeSingle();
      const folder = (data as unknown as { wells: { drive_folder_id: string | null } | null } | null)?.wells?.drive_folder_id;
      if (folder && !(ctx.rows.get(folder)?.kind === "folder" && ctx.rows.get(folder)?.shared === false)) folderStillShared = true;
    }
  }
  if (result.errors.length) return "Saved. Drive hasn't caught up yet; WellWatch will retry within 10 minutes.";
  if (folderStillShared) return "Hidden on WellWatch. Its Drive folder is still shared by link until folders are made private (Admin → Today), so anyone with the folder's link can still find it.";
  return null;
}

export type FolderResult = { madePrivate: string[]; skipped: string[]; errors: string[]; files?: number };

/**
 * Makes well folders private, one at a time: remove the folder's link, give each file of
 * it that funders may see its own link and have Drive confirm it, and if any can't be
 * confirmed, put the folder's link back (nothing changes for funders). Files are found by
 * where they really are in Drive, subfolders included. `max` stops after that many folders.
 */
export async function makeFoldersPrivate(db: Db, files: DriveFile[], rootId: string, ops: DriveOps = driveOps, deadline = Date.now() + 150_000, max = Infinity, retryDelayMs = 2000): Promise<FolderResult> {
  const out: FolderResult = { madePrivate: [], skipped: [], errors: [] };
  const { desired, rows } = await load(db);
  const byId = new Map(files.map((f) => [f.id, f]));
  const topOf = topFolderOf(files, rootId);
  const inFolder = (id: string) => desired.filter((d) => byId.has(d.file_id) && topOf(d.file_id) === id);
  let roots = files.filter((f) => f.mimeType === FOLDER_MIME && f.parents.includes(rootId));
  // A trial ("Try one folder first") should test the part that can break: pick the folder
  // with the fewest files funders see, but at least one. An empty folder proves nothing.
  if (Number.isFinite(max)) {
    const n = new Map(roots.map((f) => [f.id, inFolder(f.id).length]));
    roots = [...roots].sort((a, b) => ((n.get(a.id) || 1e9) - (n.get(b.id) || 1e9)));
  }
  const ctx: Ctx = { db, ops, deadline, result: empty(), rows };

  for (const folder of roots) {
    if (out.madePrivate.length >= max) break;
    if (Date.now() > deadline) { out.skipped.push(`${folder.name}: out of time, press again`); continue; }
    const row = rows.get(folder.id);
    if (row?.kind === "folder" && !row.shared && folder.augmented === false) continue; // already private
    const inside = inFolder(folder.id);
    try {
      await ops.unshare(folder.id);
      const failed: string[] = [];
      for (const d of inside) {
        const before = ctx.result.errors.length;
        await shareVerified(ctx, d, d.kind);
        if (ctx.result.errors.length > before) {
          // Drive can take a moment to drop the folder's link from its files: try once more.
          await new Promise((r) => setTimeout(r, retryDelayMs));
          ctx.result.errors.length = before;
          await shareVerified(ctx, d, d.kind);
        }
        if (ctx.result.errors.length > before || !(await ops.directLink(d.file_id))) failed.push(d.file_id);
      }
      if (failed.length) {
        // Something funders see would break: put the folder's link back and leave it.
        await ops.share(folder.id);
        out.errors.push(`${folder.name}: ${failed.length} of ${inside.length} file(s) couldn't get their own link, so the folder's link was put back. Nothing changed for funders.`);
        continue;
      }
      await record(ctx, folder.id, "folder", false, false, null);
      out.madePrivate.push(folder.name);
      out.files = (out.files ?? 0) + inside.length;
    } catch (e) {
      // Make sure a half-done folder isn't left broken.
      try { await ops.share(folder.id); } catch { /* reported below */ }
      out.errors.push(`${folder.name}: ${errorMessage(e)} (the folder's link was put back)`);
    }
  }
  out.errors.push(...ctx.result.errors);
  return out;
}
