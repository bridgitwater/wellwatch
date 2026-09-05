import { WellMap } from "./well-map";
import { countryName, fmtDate, fmtInt } from "@/lib/format";
import type { WaterTest, Well } from "@/lib/types";

export function CommunityPanel({ well, tests }: { well: Well; tests: WaterTest[] }) {
  const latest = tests[0];
  const facts: [string, string][] = [
    ["People served", fmtInt(well.people_served)],
    ["Water source", well.source_type ?? "—"],
    ["Depth", well.depth_m ? `${Number(well.depth_m)} m` : "—"],
    ["Yield", well.yield_lph ? `${fmtInt(well.yield_lph)} L/hour` : "—"],
  ];

  return (
    <section aria-labelledby="community-h" className="rounded-xl border border-line bg-surface p-5">
      <h2 id="community-h" className="text-lg font-bold">The community</h2>
      <div className="text-sm text-ink-2 mt-0.5">
        {[well.village, well.region, countryName(well.country)].filter(Boolean).join(", ")}
      </div>

      {well.approx_lat != null && well.approx_lng != null && (
        <div className="mt-4">
          <WellMap lat={well.approx_lat} lng={well.approx_lng} label={well.name} />
          <p className="text-xs text-ink-3 mt-1.5">Pin shows the village, not the exact borehole, for the community&apos;s privacy.</p>
        </div>
      )}

      {well.summary && <p className="text-[15px] leading-relaxed mt-4">{well.summary}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="font-semibold tnum">{v}</dd>
          </div>
        ))}
      </dl>

      {latest && (
        <div className="mt-5 pt-4 border-t border-line">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Water quality</h3>
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${latest.passed ? "bg-ok-soft text-ok" : "bg-clay-soft text-clay"}`}>
              {latest.passed ? "Safe to drink" : latest.passed === false ? "Retest scheduled" : "Tested"}
            </span>
          </div>
          <div className="text-xs text-ink-3 mt-0.5">
            Tested {fmtDate(latest.tested_at)}{latest.lab ? ` · ${latest.lab}` : ""}
          </div>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Fact k="E. coli" v={latest.e_coli_cfu != null ? `${latest.e_coli_cfu} / 100 ml` : "—"} hint="WHO: 0" />
            <Fact k="pH" v={latest.ph ?? "—"} hint="6.5–8.5" />
            <Fact k="Turbidity" v={latest.turbidity_ntu != null ? `${latest.turbidity_ntu} NTU` : "—"} hint="< 5" />
            <Fact k="Fluoride" v={latest.fluoride_mgl != null ? `${latest.fluoride_mgl} mg/L` : "—"} hint="< 1.5" />
          </dl>
        </div>
      )}
    </section>
  );
}

function Fact({ k, v, hint }: { k: string; v: string; hint: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{k}</dt>
      <dd className="font-semibold tnum">{v}</dd>
      <dd className="text-[11px] text-ink-3">guideline {hint}</dd>
    </div>
  );
}
