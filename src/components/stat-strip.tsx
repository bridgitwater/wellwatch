import { fmtInt } from "@/lib/format";
import type { Well } from "@/lib/types";

/** The numbers every completion report leads with: households, people, walk, time. */
export function StatStrip({ well }: { well: Well }) {
  const stats: { k: string; v: string; sub?: string }[] = [];
  if (well.households) stats.push({ k: "Households", v: fmtInt(well.households) });
  if (well.people_served) {
    stats.push({ k: "People served", v: fmtInt(well.people_served), sub: well.households ? "about 6 per household" : undefined });
  }
  if (well.before_distance_km != null || well.after_distance_m != null) {
    const before = well.before_distance_km != null ? `${Number(well.before_distance_km)} km` : "—";
    const after = well.after_distance_m != null ? (well.after_distance_m >= 1000 ? `${well.after_distance_m / 1000} km` : `${well.after_distance_m} m`) : "—";
    stats.push({ k: "Walk to water", v: `${before} → ${after}`, sub: "before → after" });
  }
  if (well.hours_saved_day != null) stats.push({ k: "Time saved", v: `${Number(well.hours_saved_day)} hrs`, sub: "per household, every day" });
  if (stats.length === 0) return null;

  return (
    <dl
      className={`grid gap-px rounded-xl overflow-hidden border border-line bg-line ${
        stats.length === 1 ? "grid-cols-1 sm:max-w-xs" : stats.length === 2 ? "grid-cols-2" : stats.length === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"
      }`}
    >
      {stats.map((s) => (
        <div key={s.k} className="bg-surface px-5 py-4">
          <dt className="text-xs uppercase tracking-wide text-ink-3 font-semibold">{s.k}</dt>
          <dd className="display text-xl sm:text-3xl font-bold tnum mt-1 leading-none whitespace-nowrap">{s.v}</dd>
          {s.sub && <dd className="text-xs text-ink-3 mt-1.5">{s.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
