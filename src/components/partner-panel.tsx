import { DriveImage } from "./drive-image";
import { countryName } from "@/lib/format";
import type { Partner } from "@/lib/types";

export function PartnerPanel({ partner }: { partner: Partner | null }) {
  if (!partner) return null;
  const site = partner.website ? partner.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
  return (
    <section aria-labelledby="partner-h" className="rounded-xl border border-line bg-surface p-5">
      <h2 id="partner-h" className="text-lg font-bold">Built by our local partner</h2>
      <div className="mt-2 flex items-start gap-3">
        {partner.logo_file_id && (
          <DriveImage fileId={partner.logo_file_id} alt="" width={160} className="h-12 w-12 rounded object-contain bg-bg shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-bold text-lg leading-tight">{partner.name}</div>
          {partner.country && <div className="text-sm text-ink-2">{countryName(partner.country)}</div>}
        </div>
      </div>
      {partner.intro && <p className="text-sm leading-relaxed mt-3">{partner.intro}</p>}
      {(partner.contact_name || site) && (
        <div className="text-sm text-ink-2 mt-3">
          {partner.contact_name && (
            <div>{partner.contact_name}{partner.contact_title ? `, ${partner.contact_title}` : ""}</div>
          )}
          {site && partner.website && (
            <a className="underline" href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noreferrer">{site}</a>
          )}
        </div>
      )}
      <p className="text-xs text-ink-3 mt-3">Managed by Bridgit Water Foundation, Australia.</p>
    </section>
  );
}
