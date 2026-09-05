import { google, type drive_v3 } from "googleapis";

let cached: drive_v3.Drive | null = null;

/** Drive API client authenticated as the wellwatch-sync service account. Server-only. */
export function getDrive(): drive_v3.Drive {
  if (cached) return cached;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not set");
  const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

export function sharedDriveId() {
  const id = process.env.DRIVE_SHARED_DRIVE_ID;
  if (!id) throw new Error("DRIVE_SHARED_DRIVE_ID is not set");
  return id;
}

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  createdTime: string;
  modifiedTime: string;
  width?: number;
  height?: number;
  /** EXIF capture time as an ISO instant, when already known (tests / other sources). */
  takenAt?: string;
  /** Raw EXIF capture time from Drive, "2026:07:06 14:55:02" — local wall-clock, no zone.
   *  Interpreted in the well's country zone by the sync planner. */
  exifLocal?: string;
  durationS?: number;
};

const FILE_FIELDS =
  "nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, " +
  "imageMediaMetadata(width, height, time), videoMediaMetadata(width, height, durationMillis))";

/** Every non-trashed file and folder in the Shared Drive. */
export async function listAllInDrive(): Promise<DriveFile[]> {
  const drive = getDrive();
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      driveId: sharedDriveId(),
      corpora: "drive",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: "trashed = false",
      pageSize: 1000,
      fields: FILE_FIELDS,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      out.push({
        id: f.id!,
        name: f.name ?? "",
        mimeType: f.mimeType ?? "",
        parents: f.parents ?? [],
        createdTime: f.createdTime!,
        modifiedTime: f.modifiedTime!,
        width: f.imageMediaMetadata?.width ?? f.videoMediaMetadata?.width ?? undefined,
        height: f.imageMediaMetadata?.height ?? f.videoMediaMetadata?.height ?? undefined,
        exifLocal: f.imageMediaMetadata?.time ?? undefined,
        durationS: f.videoMediaMetadata?.durationMillis
          ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000)
          : undefined,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

/** Create a well's folder at the root of the Shared Drive and make it viewable by link. */
export async function createWellFolder(code: string, name: string, makePublic = true) {
  const drive = getDrive();
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: `${code} · ${name}`,
      mimeType: FOLDER_MIME,
      parents: [sharedDriveId()],
    },
    fields: "id",
  });
  const id = res.data.id!;
  if (makePublic) await setFolderPublic(id, true);
  return id;
}

export async function setFolderPublic(folderId: string, isPublic: boolean) {
  const drive = getDrive();
  if (isPublic) {
    await drive.permissions.create({
      fileId: folderId,
      supportsAllDrives: true,
      requestBody: { type: "anyone", role: "reader", allowFileDiscovery: false },
    });
  } else {
    const perms = await drive.permissions.list({
      fileId: folderId,
      supportsAllDrives: true,
      fields: "permissions(id, type)",
    });
    for (const p of perms.data.permissions ?? []) {
      if (p.type === "anyone" && p.id)
        await drive.permissions.delete({ fileId: folderId, permissionId: p.id, supportsAllDrives: true });
    }
  }
}
