import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPanel } from "@/components/community-panel";
import { DriveImage } from "@/components/drive-image";
import { ImpactPanel } from "@/components/impact-panel";
import { StagePill } from "@/components/stage-pill";
import { StageTracker } from "@/components/stage-tracker";
import { UpdateFeed } from "@/components/update-feed";
import { getMyWells, getWellPage } from "@/lib/data";
import { countryName, fmtRelative } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/wells/[code]">): Promise<Metadata> {
  const { code } = await params;
  const page = await getWellPage(code);
  return { title: page ? `${page.well.name} well` : "Well" };
}

export default async function WellPage({ params }: PageProps<"/wells/[code]">) {
  const { code } = await params;
  const [page, mine] = await Promise.all([getWellPage(code), getMyWells()]);
  if (!page) notFound();

  const { well, stages, updates, costs, waterTests, funding, cofunders } = page;
  const cover = updates.flatMap((u) => u.media).find((m) => m.kind === "photo");
  const latest = updates[0];
  const complete = well.status === "handover";

  return (
    <article className="mx-auto max-w-5xl px-5 py-6">
      {mine.length > 1 && (
        <Link href="/wells" className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1 mb-4">
          <span aria-hidden="true">←</span> All your wells
        </Link>
      )}

      {/* Header */}
      <header className="grid gap-5 md:grid-cols-[1fr_minmax(0,420px)] md:items-end">
        <div>
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span className="font-mono text-xs tracking-wide">{well.code}</span>
            <StagePill stage={well.status} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mt-2 leading-[1.05]">{well.name}</h1>
          <p className="text-lg text-ink-2 mt-2">
            {[well.region, countryName(well.country)].filter(Boolean).join(", ")}
            {well.people_served ? ` · ${well.people_served.toLocaleString("en-AU")} people` : ""}
          </p>
          <p className="text-sm text-ink-3 mt-3">
            {complete
              ? "This well is complete and in the community's hands."
              : latest
                ? `Last update ${fmtRelative(latest.happened_at)}.`
                : "Waiting for the first update from the field."}
          </p>
        </div>
        {cover && (
          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-aquifer">
            <DriveImage fileId={cover.drive_file_id} alt={`${well.name} well`} width={1200} loading="eager" className="h-full w-full object-cover" />
          </div>
        )}
      </header>

      {/* Body */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <StageTracker status={well.status} stages={stages} />
          <UpdateFeed updates={updates} wellName={well.name} />
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <ImpactPanel well={well} funding={funding} costs={costs} cofunders={cofunders} />
          <CommunityPanel well={well} tests={waterTests} />
        </aside>
      </div>
    </article>
  );
}
