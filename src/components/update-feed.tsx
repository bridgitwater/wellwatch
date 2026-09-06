"use client";

import { useEffect, useState } from "react";
import { DriveImage } from "./drive-image";
import { stageLabel } from "@/lib/stages";
import { fmtDateIn } from "@/lib/format";
import { driveEmbed, driveView, isPlaceholderId } from "@/lib/media";
import type { Media, Update, WellType } from "@/lib/types";

export function UpdateFeed({ updates, wellName, country, type = "drilled", title = "From the field" }: { updates: Update[]; wellName: string; country?: string | null; type?: WellType; title?: string }) {
  const [open, setOpen] = useState<Media | null>(null);

  if (updates.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-line p-6 text-center text-ink-2">
        <div className="font-semibold text-ink">No updates yet</div>
        <p className="text-sm mt-1">Photos and notes from our local partner appear here as work begins. We&apos;ll email you when the first ones arrive.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="updates-h">
      <h2 id="updates-h" className="text-lg font-bold mb-3">{title}</h2>
      <ol className="flex flex-col gap-6">
        {updates.map((u) => (
          <li key={u.id} className="rounded-xl border border-line bg-surface overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 text-sm">
              <time dateTime={u.happened_at} className="font-semibold">
                {fmtDateIn(country, u.happened_at)}
              </time>
              {u.stage && <span className="text-xs font-semibold rounded-full bg-aquifer text-water-deep px-2 py-0.5">{stageLabel(u.stage, type)}</span>}
            </div>
            {u.body && <p className="px-5 pb-4 prose-body max-w-prose">{u.body}</p>}
            <MediaGrid media={u.media} wellName={wellName} onOpen={setOpen} />
          </li>
        ))}
      </ol>
      {open && <Lightbox media={open} wellName={wellName} country={country} onClose={() => setOpen(null)} />}
    </section>
  );
}

function MediaGrid({ media, wellName, onOpen }: { media: Media[]; wellName: string; onOpen: (m: Media) => void }) {
  if (media.length === 0) return null;
  const photos = media.filter((m) => m.kind === "photo");
  const others = media.filter((m) => m.kind !== "photo");
  const cols = photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="flex flex-col gap-px bg-line">
      {photos.length > 0 && (
        <div className={`grid ${cols} gap-px`}>
          {photos.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m)}
              className={`block bg-surface ${photos.length === 1 ? "aspect-[3/2] max-h-[480px] w-full" : "aspect-square"} overflow-hidden focus-visible:outline-offset-[-3px]`}
              aria-label={m.caption ?? `Open photo from ${wellName}`}
            >
              <DriveImage fileId={m.drive_file_id} alt={m.caption ?? `${wellName} well`} width={photos.length === 1 ? 1200 : 640}
                className="h-full w-full object-cover hover:opacity-95 transition-opacity" />
            </button>
          ))}
        </div>
      )}
      {others.map((m) => (
        <div key={m.id} className="bg-surface">
          {m.kind === "video" ? (
            <VideoEmbed media={m} />
          ) : (
            <a href={driveView(m.drive_file_id)} target="_blank" rel="noreferrer" className="block px-5 py-3 text-sm underline">
              {m.kind === "audio" ? "Listen to voice note" : m.name ?? "Open file"}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function VideoEmbed({ media }: { media: Media }) {
  const [play, setPlay] = useState(false);
  const ratio = media.width && media.height ? media.width / media.height : 16 / 9;
  const portrait = ratio < 1;

  if (isPlaceholderId(media.drive_file_id)) {
    return <div className="aspect-video bg-aquifer flex items-center justify-center text-xs text-water-deep/60">sample video</div>;
  }

  return (
    <div className={`mx-auto ${portrait ? "max-w-sm" : ""}`} style={{ aspectRatio: String(Math.max(ratio, 0.5)) }}>
      {play ? (
        <iframe
          src={driveEmbed(media.drive_file_id)}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title={media.caption ?? "Video from the field"}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          className="group relative h-full w-full bg-ink text-white flex items-center justify-center"
          aria-label="Play video"
        >
          <DriveImage fileId={media.drive_file_id} alt="" width={1200} className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-90" />
          <span className="relative h-14 w-14 rounded-full bg-white/90 text-ink flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor" /></svg>
          </span>
          {media.duration_s != null && (
            <span className="absolute bottom-2 right-3 text-xs font-medium tnum bg-black/50 rounded px-1.5 py-0.5">
              {Math.floor(media.duration_s / 60)}:{String(media.duration_s % 60).padStart(2, "0")}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function Lightbox({ media, wellName, country, onClose }: { media: Media; wellName: string; country?: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-sm px-3 py-1.5 rounded bg-white/10"
      >
        Close
      </button>
      <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <DriveImage fileId={media.drive_file_id} alt={media.caption ?? `${wellName} well`} width={2000} loading="eager"
          className="max-h-[85vh] max-w-full object-contain rounded" />
        <figcaption className="text-white/80 text-sm mt-3 flex justify-between gap-4">
          <span>{media.caption ?? ""}</span>
          <span className="flex gap-4 shrink-0">
            {media.taken_at && <span>{fmtDateIn(country, media.taken_at)}</span>}
            {!isPlaceholderId(media.drive_file_id) && (
              <a href={driveView(media.drive_file_id)} target="_blank" rel="noreferrer" className="underline">Open in Drive</a>
            )}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
