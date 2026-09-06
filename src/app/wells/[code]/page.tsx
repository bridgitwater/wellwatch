import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPanel } from "@/components/community-panel";
import { DriveImage } from "@/components/drive-image";
import { GiftPanel } from "@/components/gift-panel";
import { ImpactSection } from "@/components/impact-section";
import { PartnerPanel } from "@/components/partner-panel";
import { StagePill } from "@/components/stage-pill";
import { StageTracker } from "@/components/stage-tracker";
import { StatStrip } from "@/components/stat-strip";
import { Testimonials } from "@/components/testimonials";
import { UpdateFeed } from "@/components/update-feed";
import { getMyWells, getWellPage } from "@/lib/data";
import { countryName, fmtDate, fmtRelative } from "@/lib/format";
import { WELL_TYPE_LABEL } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/wells/[code]">): Promise<Metadata> {
  const { code } = await params;
  const page = await getWellPage(code);
  return { title: page ? `${page.well.name} · ${WELL_TYPE_LABEL[page.well.well_type]}` : "Well" };
}

export default async function WellPage({ params }: PageProps<"/wells/[code]">) {
  const { code } = await params;
  const [page, mine] = await Promise.all([getWellPage(code), getMyWells()]);
  if (!page) notFound();

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
      {mine.length > 1 && (
        <Link href="/wells" className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1 mb-4">
          <span aria-hidden="true">←</span> All your wells
        </Link>
      )}

      {/* Header — reads like the report cover */}
      <header className="grid gap-5 md:grid-cols-[1fr_minmax(0,420px)] md:items-end">
        <div>
          <div className="text-xs font-semibold tracking-[0.12em] uppercase text-water">
            {well.program_name ?? "BridgIT Water Foundation"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mt-2 leading-[1.05]">{well.name}</h1>
          <p className="text-lg text-ink-2 mt-2">
            {WELL_TYPE_LABEL[well.well_type]} · {[well.region, countryName(well.country)].filter(Boolean).join(", ")}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2 mt-3">
            <StagePill stage={well.status} />
            <span className="font-mono text-xs tracking-wide">{well.code}</span>
            {well.sponsor_line && <span>Sponsored by {well.sponsor_line}</span>}
          </div>
          <p className="text-sm text-ink-3 mt-3">
            {complete
              ? `Completed${well.completed_at ? ` ${fmtDate(well.completed_at)}` : ""} and in the community's hands.`
              : latest
                ? `Last update ${fmtRelative(latest.happened_at)}.`
                : "Waiting for the first update from the field."}
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
              <h2 id="notes-h" className="text-lg font-bold">Honest notes from the team</h2>
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
          <GiftPanel well={well} funding={funding} costs={costs} cofunders={cofunders} plaque={plaque} />
          <CommunityPanel well={well} tests={waterTests} />
          <PartnerPanel partner={partner} />
        </aside>
      </div>
    </article>
  );
}
