import { fmtDate, fmtMoney } from "@/lib/format";
import { COST_LABEL, type Cost, type Funding, type Well } from "@/lib/types";

export function ImpactPanel({ well, funding, costs, cofunders }: { well: Well; funding: Funding | null; costs: Cost[]; cofunders: number }) {
  const total = costs.reduce((s, c) => s + Number(c.amount), 0);
  const others = Math.max(cofunders - 1, 0);

  return (
    <section aria-labelledby="impact-h" className="rounded-xl border border-line bg-surface p-5">
      <h2 id="impact-h" className="text-lg font-bold mb-3">Your gift</h2>

      <div className="flex items-baseline gap-2">
        <span className="display text-3xl font-bold tnum">{fmtMoney(funding?.amount, funding?.currency ?? well.currency)}</span>
        {funding?.funded_at && <span className="text-sm text-ink-2">given {fmtDate(funding.funded_at)}</span>}
      </div>
      <p className="text-sm text-ink-2 mt-1">
        {others === 0
          ? "You funded this well in full."
          : `You and ${others} other${others === 1 ? "" : "s"} funded this well together.`}
      </p>

      {well.dedication && (
        <div className="mt-4 rounded-lg bg-aquifer px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-water-deep/70 font-semibold">Dedication</div>
          <div className="display text-water-deep font-semibold mt-0.5">{well.dedication}</div>
        </div>
      )}

      {costs.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink-2 mb-2">What it paid for</h3>
          <ul className="flex flex-col gap-1.5">
            {costs
              .slice()
              .sort((a, b) => Number(b.amount) - Number(a.amount))
              .map((c) => {
                const pct = total ? (Number(c.amount) / total) * 100 : 0;
                return (
                  <li key={c.category} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{COST_LABEL[c.category]}</span>
                      <span className="tnum text-ink-2">{fmtMoney(c.amount, c.currency)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-line mt-1">
                      <div className="h-1 rounded-full bg-water" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
          <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-line">
            <span>Total project cost</span>
            <span className="tnum">{fmtMoney(total, well.currency)}</span>
          </div>
        </div>
      )}

      {well.status === "handover" && (
        <a
          href={`/wells/${well.code}/certificate`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-water text-water font-semibold px-4 py-2.5 text-sm hover:bg-aquifer transition-colors"
        >
          Download completion certificate
        </a>
      )}
    </section>
  );
}
