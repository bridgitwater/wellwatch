import "server-only";
import { errorMessage, type createAdminClient } from "../supabase/admin";
import { FOLDER_MIME, getDrive, type DriveFile } from "./client";

/**
 * Private Drive folders, in two phases.
 *
 * 1. Every Drive sync (and straight after an admin hides or shows something), each file
 *    funders may see gets a link of its own ("anyone with the link", reader), and Drive is
 *    asked to confirm it is the file's own permission, not one inherited from its folder.
 *    Files that shouldn't be viewable (hidden, or not used) lose their own link.
 * 2. An admin presses "Make folders private" on the dashboard. A folder only goes private
 *    when every file of its that funders may see has a confirmed link of its own; each
 *    file is checked again before and after. From then on the sync re-checks folders and
 *    takes away any link someone adds to a folder by hand.
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
  const privateFolder = (id: string | null) => !!id && ctx.rows.get(id)?.kind === "folder" && ctx.rows.get(id)?.shared === false;

  // Share: files with no confirmed link of their own. Drive's own flag catches links that
  // were removed outside WellWatch; files in private folders go first (they're broken now).
  const todo = desired
    .filter((d) => {
      const row = ctx.rows.get(d.file_id);
      const inDrive = byId.get(d.file_id);
      if (!inDrive) {
        // Not in the Wells drive (e.g. a report kept in someone's My Drive): try once a day, never block anything.
        return !(row && !row.direct && Date.now() - Date.parse(row.updated_at) < DAY) && !(row?.direct);
      }
      return !row?.direct || inDrive.augmented === false;
    })
    .sort((a, b) => Number(privateFolder(b.folder_id)) - Number(privateFolder(a.folder_id)));
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
  for (const id of new Set(fileIds)) {
    const d = want.get(id);
    if (d) await shareVerified(ctx, d, d.kind);
    else {
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

export type FolderResult = { madePrivate: string[]; skipped: string[]; errors: string[] };

/**
 * Phase 2: make shared well folders private. A folder is only done when every file of
 * its that funders may see has a confirmed link of its own, checked fresh. Afterwards
 * each of those files is checked again; any that lost its link is shared again.
 */
export async function makeFoldersPrivate(db: Db, files: DriveFile[], rootId: string, ops: DriveOps = driveOps, deadline = Date.now() + 150_000, max = Infinity): Promise<FolderResult> {
  const out: FolderResult = { madePrivate: [], skipped: [], errors: [] };
  const { desired, rows } = await load(db);
  const byId = new Map(files.map((f) => [f.id, f]));
  const parentOf = new Map(files.filter((f) => f.mimeType === FOLDER_MIME).map((f) => [f.id, f.parents[0]]));
  const topOf = (id: string) => {
    let cur = byId.get(id)?.parents[0];
    for (let i = 0; cur && i < 20; i++) {
      const p = parentOf.get(cur);
      if (!p || p === rootId) return cur;
      cur = p;
    }
    return cur ?? null;
  };
  const roots = files.filter((f) => f.mimeType === FOLDER_MIME && f.parents.includes(rootId));
  const ctx: Ctx = { db, ops, deadline, result: empty(), rows };

  for (const folder of roots) {
    if (out.madePrivate.length >= max) break;
    if (Date.now() > deadline) { out.skipped.push(`${folder.name}: out of time, press again`); continue; }
    const row = rows.get(folder.id);
    if (row?.kind === "folder" && !row.shared && folder.augmented === false) continue; // already private
    // Its files funders may see, located by where they really are in Drive.
    const inside = desired.filter((d) => byId.has(d.file_id) && topOf(d.file_id) === folder.id);
    try {
      const unready: string[] = [];
      for (const d of inside) if (!(await ops.directLink(d.file_id))) unready.push(d.file_id);
      if (unready.length) { out.skipped.push(`${folder.name}: ${unready.length} file(s) not yet shared on their own; the next sync will do it`); continue; }
      await ops.unshare(folder.id);
      const broken: string[] = [];
      for (const d of inside) {
        if (await ops.directLink(d.file_id)) continue;
        await shareVerified(ctx, d, d.kind);
        if (!(await ops.directLink(d.file_id))) broken.push(d.file_id);
      }
      if (broken.length) {
        // Something funders see would break: put the folder's link back and stop here.
        await ops.share(folder.id);
        out.errors.push(`${folder.name}: ${broken.length} file(s) lost their link when the folder went private, so the folder was shared again. Nothing changed for funders.`);
        continue;
      }
      await record(ctx, folder.id, "folder", false, false, null);
      out.madePrivate.push(folder.name);
    } catch (e) {
      out.errors.push(`${folder.name}: ${errorMessage(e)}`);
    }
  }
  out.errors.push(...ctx.result.errors);
  return out;
}
