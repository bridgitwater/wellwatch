import type { Well } from "@/lib/types";

const lines = (s: string | null | undefined) =>
  (s ?? "").split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/** Impacts, the Water User Committee, training and sustainability — the "will it last?" part of the report. */
export function ImpactSection({ well }: { well: Well }) {
  const impacts = lines(well.impacts);
  const hasWuc = well.wuc_members != null;
  if (impacts.length === 0 && !hasWuc && !well.training_note && !well.sustainability) return null;

  return (
    <section aria-labelledby="impact-h" className="rounded-xl border border-line bg-surface p-5">
      <h2 id="impact-h" className="text-lg font-bold">What changes for {well.name}</h2>

      {impacts.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {impacts.map((l, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-water" aria-hidden="true" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      )}

      {(hasWuc || well.training_note || well.sustainability) && (
        <div className="mt-5 pt-5 border-t border-line">
          <h3 className="font-semibold">Owned by the community</h3>
          {hasWuc && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip n={well.wuc_members!} label="committee members" />
              {well.wuc_women != null && <Chip n={well.wuc_women} label="women" />}
              {well.wuc_youth != null && <Chip n={well.wuc_youth} label="youth" />}
              {well.wuc_pwd != null && <Chip n={well.wuc_pwd} label={well.wuc_pwd === 1 ? "person with a disability" : "people with disabilities"} />}
              {well.wuc_treasurer_woman && <span className="rounded-full bg-aquifer text-water-deep text-sm px-3 py-1">Treasurer is a woman</span>}
            </div>
          )}
          {well.training_note && <p className="text-[15px] leading-relaxed mt-3">{well.training_note}</p>}
          {well.sustainability && <p className="text-[15px] leading-relaxed mt-3 text-ink-2">{well.sustainability}</p>}
          {hasWuc && !well.training_note && (
            <p className="text-sm text-ink-2 mt-3">
              A trained Water User Committee looks after the pump, collects a small user fee for repairs, and runs hygiene and sanitation training in the village.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Chip({ n, label }: { n: number; label: string }) {
  return (
    <span className="rounded-full border border-line text-sm px-3 py-1">
      <strong className="tnum">{n}</strong> {label}
    </span>
  );
}
