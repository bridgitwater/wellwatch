import Link from "next/link";
import { CommunityPanel } from "./community-panel";
import { DriveImage } from "./drive-image";
import { GiftPanel } from "./gift-panel";
import { ImpactSection } from "./impact-section";
import { PartnerPanel } from "./partner-panel";
import { StagePill } from "./stage-pill";
import { StageTracker } from "./stage-tracker";
import { StatStrip } from "./stat-strip";
import { Testimonials } from "./testimonials";
import { UpdateFeed } from "./update-feed";
import type { WellPage } from "@/lib/data";
import { countryName, fmtDate, fmtRelative } from "@/lib/format";
import { WELL_TYPE_LABEL } from "@/lib/types";

type Props = {
  page: WellPage;
  /** "funder": signed-in view with the gift panel. "public": the /example page — no gift, dedication or costs. */
  mode: "funder" | "public";
  /** Show the "All your wells" back link (funder mode, more than one well). */
  showBack?: boolean;
};

/** The well page itself, shared by the signed-in funder route and the public example route. */
export function WellArticle({ page, mode, showBack = false }: Props) {
  const { well, stages, updates, costs, waterTests, funding, cofunders, partner, testimonials } = page;
  const allMedia = updates.flatMap((u) => u.media);
  const photos = allMedia.filter((m) => m.kind === "photo");
  const cover = photos.find((m) => m.tag === "inauguration") ?? photos[0] ?? null;
  const plaque = photos.find((m) => m.tag === "plaque") ?? null;
  const beforePhotos = photos.filter((m) => m.tag === "before");
  const latest = updates[0];
  const complete = well.status === "handover";
  const place = well.village ?? well.name;

  return (
    <article className="mx-auto max-w-5xl px-5 py-6">
      {showBack && (
        <Link href="/wells" className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1 mb-4">
          <span aria-hidden="true">←</span> All your wells
        </Link>
      )}

      {/* Header — reads like the report cover */}
      <header className="grid gap-5 md:grid-cols-[1fr_minmax(0,420px)] md:items-end">
        <div>
          <div className="text-xs font-semibold tracking-[0.12em] uppercase text-water">
            {well.program_name ?? "Bridgit Water Foundation"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mt-2 leading-[1.05]">{well.name}</h1>
          <p className="text-lg text-ink-2 mt-2">
            {WELL_TYPE_LABEL[well.well_type]} · {[well.region, countryName(well.country)].filter(Boolean).join(", ")}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2 mt-3">
            <StagePill stage={well.status} type={well.well_type} />
            <span className="font-mono text-xs tracking-wide">{well.code}</span>
            {well.sponsor_line && <span>Funded by {well.sponsor_line}</span>}
            {mode === "funder" && well.showcase && (
              <a href={`/example/${well.code}`} className="text-water underline" target="_blank" rel="noreferrer" title="A public version of this page you can share with family and friends — your gift details aren't shown">
                Share this well
              </a>
            )}
          </div>
          <p className="text-sm text-ink-3 mt-3">
            {complete
              ? `Completed${well.completed_at ? ` ${fmtDate(well.completed_at)}` : ""} and in the community's hands.`
              : latest
                ? `Last update ${fmtRelative(latest.happened_at)}.`
                : "The first update from the field is on its way."}
          </p>
        </div>
        {cover && (
          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-aquifer">
            <DriveImage fileId={cover.drive_file_id} alt={cover.caption ?? `${well.name} well`} width={1200} loading="eager" className="h-full w-full object-cover" />
          </div>
        )}
      </header>

      <div className="mt-6">
        <StatStrip well={well} />
      </div>

      {/* Body */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <StageTracker status={well.status} stages={stages} type={well.well_type} />

          {(well.before_story || beforePhotos.length > 0) && (
            <section aria-labelledby="before-h" className="rounded-xl border border-line bg-surface overflow-hidden">
              <div className="p-5">
                <h2 id="before-h" className="text-lg font-bold">Before</h2>
                {well.before_story && <p className="prose-body mt-2 max-w-prose whitespace-pre-line">{well.before_story}</p>}
              </div>
              {beforePhotos.length > 0 && (
                <div className={`grid gap-px bg-line ${beforePhotos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {beforePhotos.slice(0, 4).map((m) => (
                    <div key={m.id} className={`bg-surface ${beforePhotos.length === 1 ? "aspect-[2/1]" : "aspect-[4/3]"}`}>
                      <DriveImage fileId={m.drive_file_id} alt={m.caption ?? "The old water source"} width={900} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Once complete, the people and the outcomes come before the long build log. */}
          {complete && <Testimonials items={testimonials} place={place} />}
          {complete && <ImpactSection well={well} />}

          <UpdateFeed updates={updates} wellName={well.name} country={well.country} type={well.well_type} title={complete ? "How it was built" : "From the field"} />

          {!complete && <Testimonials items={testimonials} place={place} />}
          {!complete && <ImpactSection well={well} />}

          {(well.challenges || well.lessons) && (
            <section aria-labelledby="notes-h" className="rounded-xl border border-line bg-surface p-5">
              <h2 id="notes-h" className="text-lg font-bold">Notes from the team</h2>
              {well.challenges && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-ink-2">Challenges</h3>
                  <p className="prose-body mt-1 whitespace-pre-line">{well.challenges}</p>
                </div>
              )}
              {well.lessons && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-ink-2">What we learned</h3>
                  <p className="prose-body mt-1 whitespace-pre-line">{well.lessons}</p>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {mode === "funder" ? (
            <GiftPanel well={well} funding={funding} costs={costs} cofunders={cofunders} plaque={plaque} />
          ) : (
            <ExampleBanner plaque={plaque} wellName={well.name} />
          )}
          <CommunityPanel well={well} tests={waterTests} />
          <PartnerPanel partner={partner} />
        </aside>
      </div>
    </article>
  );
}

function ExampleBanner({ plaque, wellName }: { plaque: WellPage["updates"][number]["media"][number] | null; wellName: string }) {
  return (
    <section aria-labelledby="example-h" className="rounded-xl border border-line bg-surface p-5">
      <h2 id="example-h" className="text-lg font-bold">A finished well, start to end</h2>
      <p className="prose-body text-ink-2 mt-2">
        This is what every Bridgit funder sees for their own well: the progress, the photos from the field, the people it
        serves and the completion report — all in one place, updated as the work happens.
      </p>
      {plaque && (
        <div className="mt-4">
          <div className="aspect-[4/3] rounded-lg overflow-hidden bg-aquifer">
            <DriveImage fileId={plaque.drive_file_id} alt={`Acknowledgement plaque at ${wellName}`} width={800} className="h-full w-full object-cover" />
          </div>
          <p className="text-sm text-ink-2 mt-2">Every completed well carries a plaque acknowledging the people who made it possible.</p>
        </div>
      )}
      <a
        href="https://bridgitwater.org"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-water text-white px-4 py-2.5 font-semibold hover:bg-water-deep no-underline"
      >
        Fund a well like this
      </a>
      <p className="text-xs text-ink-3 mt-3">
        Already a funder? <Link href="/login" className="underline">Sign in</Link> to see your own well.
      </p>
    </section>
  );
}
