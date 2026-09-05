import { STAGE_BLURB, STAGE_LABEL, STAGE_ORDER, stageIndex, type WellStage } from "@/lib/stages";
import { fmtDate } from "@/lib/format";
import type { StageRow } from "@/lib/types";

export function StageTracker({ status, stages }: { status: WellStage; stages: StageRow[] }) {
  const current = stageIndex(status);
  const complete = status === "handover";
  const byStage = new Map(stages.map((s) => [s.stage, s]));

  return (
    <section aria-labelledby="progress-h" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 id="progress-h" className="text-lg font-bold">Progress</h2>
        <span className="text-sm text-ink-2">
          {complete ? "All stages complete" : `Stage ${current + 1} of ${STAGE_ORDER.length}`}
        </span>
      </div>

      {/* Bar */}
      <ol className="grid grid-cols-6 gap-1 mb-5" aria-hidden="true">
        {STAGE_ORDER.map((s, i) => (
          <li
            key={s}
            className={`h-1.5 rounded-full ${
              i < current || complete ? "bg-water" : i === current ? "bg-water/50" : "bg-line"
            }`}
          />
        ))}
      </ol>

      <ol className="flex flex-col gap-3">
        {STAGE_ORDER.map((s, i) => {
          const row = byStage.get(s);
          const reached = Boolean(row?.reached_at);
          const isCurrent = !complete && i === current;
          return (
            <li key={s} className="grid grid-cols-[20px_1fr_auto] gap-3 items-start">
              <span
                className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  reached
                    ? "bg-water border-water text-white"
                    : isCurrent
                      ? "border-water bg-surface"
                      : "border-line bg-surface"
                }`}
              >
                {reached && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6.5l2.2 2.2L9.5 3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {isCurrent && !reached && <span className="h-2 w-2 rounded-full bg-water" />}
              </span>
              <div className="min-w-0">
                <div className={`font-semibold leading-tight ${reached || isCurrent ? "text-ink" : "text-ink-3"}`}>
                  {STAGE_LABEL[s]}
                </div>
                <div className="text-sm text-ink-2 mt-0.5">{row?.note ?? STAGE_BLURB[s]}</div>
              </div>
              <div className="text-sm text-right tnum whitespace-nowrap">
                {reached ? (
                  <span className="text-ink-2">{fmtDate(row!.reached_at)}</span>
                ) : row?.expected_at ? (
                  <span className="text-ink-3">expected {fmtDate(row.expected_at, { year: undefined })}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
