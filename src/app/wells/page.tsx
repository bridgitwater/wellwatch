import { WELL_TYPE_LABEL } from "@/lib/types";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DriveImage } from "@/components/drive-image";
import { StagePill } from "@/components/stage-pill";
import { getMyWells, getProfile } from "@/lib/data";
import { countryName, fmtDate, fmtInt, fmtRelative } from "@/lib/format";

export default async function MyWellsPage() {
  const [profile, wells] = await Promise.all([getProfile(), getMyWells()]);

  const isAdmin = profile?.role === "admin";
  if (wells.length === 1 && !isAdmin) redirect(`/wells/${wells[0].code}`);

  const firstName = profile?.display_name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{isAdmin ? "All wells" : firstName ? `${firstName}, your wells` : "Your wells"}</h1>
        <p className="text-ink-2 mt-1">
          {isAdmin
            ? `${wells.length} wells, as funders see them.`
            : wells.length === 0
              ? "No wells are linked to this email yet."
              : `${wells.length} communities you've helped bring clean water to.`}
        </p>
      </div>

      {wells.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6 max-w-lg">
          <p className="text-ink-2">
            If you&apos;ve funded a well with BridgIT and expected to see it here, it may be linked to a different email
            address. Write to{" "}
            <a className="underline" href="mailto:wells@bridgitwater.org">wells@bridgitwater.org</a> and we&apos;ll sort it out.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {wells.map((w) => (
            <li key={w.id}>
              <Link
                href={`/wells/${w.code}`}
                className="group block rounded-xl border border-line bg-surface overflow-hidden hover:border-water transition-colors"
              >
                <div className="aspect-[16/9] bg-aquifer overflow-hidden">
                  {w.cover_file_id ? (
                    <DriveImage fileId={w.cover_file_id} alt={`${w.name} well`} width={800} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-water-deep/60">
                      Photos coming soon
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold leading-tight group-hover:text-water">{w.name}</h2>
                      <div className="text-sm text-ink-2">
                        {WELL_TYPE_LABEL[w.well_type]} · {w.region ? `${w.region}, ` : ""}{countryName(w.country)}
                      </div>
                    </div>
                    <StagePill stage={w.status} type={w.well_type} />
                  </div>
                  <dl className="mt-3 flex gap-5 text-sm">
                    <div>
                      <dt className="text-ink-3 text-xs">People served</dt>
                      <dd className="font-semibold tnum">{fmtInt(w.people_served)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3 text-xs">Last update</dt>
                      <dd className="font-semibold">{w.last_update_at ? fmtRelative(w.last_update_at) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3 text-xs">Funded</dt>
                      <dd className="font-semibold">{fmtDate(w.funded_at)}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
