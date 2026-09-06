import { DriveImage } from "./drive-image";
import type { Testimonial } from "@/lib/types";

export function Testimonials({ items, place }: { items: Testimonial[]; place: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="voices-h">
      <h2 id="voices-h" className="text-lg font-bold mb-3">Voices from {place}</h2>
      <div className={`grid gap-4 ${items.length > 1 ? "md:grid-cols-2" : ""}`}>
        {items.map((t) => (
          <figure key={t.id} className="rounded-xl border border-line bg-surface p-5 flex flex-col">
            <blockquote className="prose-body flex-1">
              <span className="display text-3xl text-water leading-none align-top mr-1" aria-hidden="true">&ldquo;</span>
              {t.quote}
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {t.photo_file_id ? (
                <DriveImage fileId={t.photo_file_id} alt="" width={160} className="h-12 w-12 rounded-full object-cover bg-aquifer" />
              ) : (
                <span className="h-12 w-12 rounded-full bg-aquifer text-water-deep font-bold flex items-center justify-center" aria-hidden="true">
                  {t.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div className="text-sm">
                <div className="font-semibold">{t.name}{t.age ? `, ${t.age}` : ""}</div>
                {t.role && <div className="text-ink-2">{t.role}</div>}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
