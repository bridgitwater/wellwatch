/**
 * Pure planning logic for the Drive sync: given what's in Drive and what's in the
 * database, decide what to insert, update and delete. No I/O, so it's unit-testable.
 */
import { FOLDER_MIME, type DriveFile } from "./client";
import { kindFromMime, type MediaKind } from "../media";
import { stageOn, type WellStage } from "../stages";

/** Well codes look like UG-2026-014: country, year, sequence. Case-insensitive, must lead the folder name. */
export const WELL_CODE_RE = /^\s*([A-Z]{2})-(\d{4})-(\d{2,4})\b/i;

export function parseWellCode(folderName: string): string | null {
  const m = folderName.match(WELL_CODE_RE);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}-${m[3].padStart(3, "0")}`;
}

export type DbWell = {
  id: string;
  code: string;
  drive_folder_id: string | null;
  stages: { stage: WellStage; reached_at: string | null }[];
};

export type DbMedia = {
  id: string;
  update_id: string;
  well_id: string;
  drive_file_id: string;
  name: string | null;
  drive_modified_at: string | null;
};

export type DbUpdate = {
  id: string;
  well_id: string;
  source: "drive" | "admin" | "whatsapp";
  happened_at: string;
};

export type NewMedia = {
  well_id: string;
  drive_file_id: string;
  kind: MediaKind;
  mime: string;
  name: string;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  taken_at: string;
  drive_modified_at: string;
};

export type NewUpdate = {
  /** Temporary key so media can reference an update that doesn't exist yet. */
  tempKey: string;
  well_id: string;
  stage: WellStage;
  happened_at: string;
  media: NewMedia[];
};

export type SyncPlan = {
  /** wells whose drive_folder_id should be set (folder matched by code). */
  linkFolders: { well_id: string; drive_folder_id: string }[];
  /** brand-new media to attach to an existing Drive update. */
  attachToExisting: { update_id: string; media: NewMedia }[];
  /** brand-new updates with their media. */
  newUpdates: NewUpdate[];
  /** existing media whose Drive name/modified changed. */
  renamed: { id: string; name: string; drive_modified_at: string }[];
  /** media rows whose Drive file is gone. */
  deleteMediaIds: string[];
  /** folders at the drive root that don't match any well — for the admin to notice. */
  unmatchedFolders: { id: string; name: string }[];
};

const GROUP_WINDOW_MS = 60 * 60 * 1000;

export function planSync(
  driveRootId: string,
  files: DriveFile[],
  wells: DbWell[],
  existingMedia: DbMedia[],
  existingUpdates: DbUpdate[],
): SyncPlan {
  const plan: SyncPlan = {
    linkFolders: [],
    attachToExisting: [],
    newUpdates: [],
    renamed: [],
    deleteMediaIds: [],
    unmatchedFolders: [],
  };

  // 1. Folders: map every folder to its top-level ancestor (a well folder).
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const parentOf = new Map(folders.map((f) => [f.id, f.parents[0]]));
  const topLevelOf = (folderId: string): string => {
    let cur = folderId;
    for (let i = 0; i < 20; i++) {
      const p = parentOf.get(cur);
      if (!p || p === driveRootId) return cur;
      cur = p;
    }
    return cur;
  };

  const wellByCode = new Map(wells.map((w) => [w.code, w]));
  const wellByFolder = new Map<string, DbWell>();
  for (const w of wells) if (w.drive_folder_id) wellByFolder.set(w.drive_folder_id, w);

  for (const f of folders) {
    if (f.parents[0] !== driveRootId) continue; // only root folders are wells
    if (wellByFolder.has(f.id)) continue;
    const code = parseWellCode(f.name);
    const well = code ? wellByCode.get(code) : undefined;
    if (well && !well.drive_folder_id) {
      plan.linkFolders.push({ well_id: well.id, drive_folder_id: f.id });
      wellByFolder.set(f.id, well);
    } else if (!well) {
      plan.unmatchedFolders.push({ id: f.id, name: f.name });
    }
  }

  // 2. Files: which well does each belong to?
  const mediaByFileId = new Map(existingMedia.map((m) => [m.drive_file_id, m]));
  const seen = new Set<string>();
  const fresh: { well: DbWell; media: NewMedia }[] = [];

  for (const f of files) {
    if (f.mimeType === FOLDER_MIME) continue;
    if (f.mimeType.startsWith("application/vnd.google-apps.")) continue; // Docs, Sheets etc.
    const parent = f.parents[0];
    if (!parent || parent === driveRootId) continue; // loose files at the root are ignored
    const well = wellByFolder.get(topLevelOf(parent));
    if (!well) continue;
    seen.add(f.id);

    const existing = mediaByFileId.get(f.id);
    if (existing) {
      if (existing.name !== f.name || existing.drive_modified_at !== f.modifiedTime) {
        plan.renamed.push({ id: existing.id, name: f.name, drive_modified_at: f.modifiedTime });
      }
      continue;
    }
    fresh.push({
      well,
      media: {
        well_id: well.id,
        drive_file_id: f.id,
        kind: kindFromMime(f.mimeType),
        mime: f.mimeType,
        name: f.name,
        width: f.width ?? null,
        height: f.height ?? null,
        duration_s: f.durationS ?? null,
        taken_at: f.takenAt ?? f.createdTime,
        drive_modified_at: f.modifiedTime,
      },
    });
  }

  // 3. Deletions: media rows whose file no longer exists in a well folder.
  for (const m of existingMedia) if (!seen.has(m.drive_file_id)) plan.deleteMediaIds.push(m.id);

  // 4. Group fresh media into updates: same well, taken within an hour of each other.
  fresh.sort((a, b) => a.media.taken_at.localeCompare(b.media.taken_at));
  const driveUpdates = existingUpdates.filter((u) => u.source === "drive");

  for (const { well, media } of fresh) {
    const t = new Date(media.taken_at).getTime();

    const existingHit = driveUpdates.find(
      (u) => u.well_id === well.id && Math.abs(new Date(u.happened_at).getTime() - t) <= GROUP_WINDOW_MS,
    );
    if (existingHit) {
      plan.attachToExisting.push({ update_id: existingHit.id, media });
      continue;
    }

    const newHit = plan.newUpdates.find(
      (u) => u.well_id === well.id && Math.abs(new Date(u.happened_at).getTime() - t) <= GROUP_WINDOW_MS,
    );
    if (newHit) {
      newHit.media.push(media);
      continue;
    }

    plan.newUpdates.push({
      tempKey: `${well.id}:${media.taken_at}`,
      well_id: well.id,
      stage: stageOn(well.stages, new Date(media.taken_at)),
      happened_at: media.taken_at,
      media: [media],
    });
  }

  return plan;
}
