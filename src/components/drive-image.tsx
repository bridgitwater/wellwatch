import { driveThumb, isPlaceholderId } from "@/lib/media";

type Props = {
  fileId: string;
  alt: string;
  width?: number;
  className?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
};

/** A photo that lives in Drive. Falls back to a quiet tile for seed placeholders. */
export function DriveImage({ fileId, alt, width = 1200, className = "", loading = "lazy" }: Props) {
  if (isPlaceholderId(fileId)) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-aquifer text-water-deep/60 flex items-center justify-center text-xs ${className}`}
      >
        sample photo
      </div>
    );
  }
  return (
    // Drive's thumbnail endpoint is a third-party host; plain <img> keeps this free of image-optimizer config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={driveThumb(fileId, width)}
      srcSet={`${driveThumb(fileId, 640)} 640w, ${driveThumb(fileId, 1200)} 1200w, ${driveThumb(fileId, 2000)} 2000w`}
      sizes="(max-width: 640px) 100vw, 800px"
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
