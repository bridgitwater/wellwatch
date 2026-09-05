/**
 * URLs for media that lives in Google Drive. These work for files inside a
 * folder shared as "anyone with the link can view".
 */

export type MediaKind = "photo" | "video" | "audio" | "document";

/** Resized image, served by Drive's thumbnail endpoint. `w` is the max width. */
export function driveThumb(fileId: string, w = 1600) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${w}`;
}

/** Drive's own player, for embedding in an iframe. Works for video and audio. */
export function driveEmbed(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

/** Open the file in Drive in a new tab. */
export function driveView(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export function kindFromMime(mime: string | null | undefined): MediaKind {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/** Seed rows use placeholder IDs; render a neutral tile for those instead of a broken image. */
export function isPlaceholderId(fileId: string) {
  return fileId.startsWith("seed-");
}
