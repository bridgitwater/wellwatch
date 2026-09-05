import { createOrganization } from "@/lib/admin/actions";
import { PartnerForm } from "@/components/admin/partner-form";
import { Button, Card, Field, Input } from "@/components/admin/ui";
import { countryName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Partners() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, country, type, intro, contact_name, contact_title, website, logo_file_id, wells(count)")
    .order("name");
  type Row = Partner & { type: string; wells: { count: number }[] };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title="Organizations">
        <ul className="divide-y divide-line">
          {rows.map((o) => (
            <li key={o.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{o.name} <span className="text-xs text-ink-3 font-normal ml-1">{o.type}</span></div>
                  <div className="text-sm text-ink-2">
                    {[o.country ? countryName(o.country) : null, o.contact_name ? `${o.contact_name}${o.contact_title ? `, ${o.contact_title}` : ""}` : null, o.website].filter(Boolean).join(" · ") || "No details yet"}
                  </div>
                  {o.intro && <p className="text-sm text-ink-2 mt-1 line-clamp-2">{o.intro}</p>}
                </div>
                <div className="text-sm tnum text-ink-2 shrink-0">{o.wells[0]?.count ?? 0} wells</div>
              </div>
              {o.type === "partner" && <div className="mt-2"><PartnerForm org={o} /></div>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add a partner">
        <form action={createOrganization} className="flex flex-col gap-3">
          <Field label="Name"><Input name="name" required placeholder="Suubi Community Projects Uganda" /></Field>
          <Field label="Country code"><Input name="country" maxLength={2} placeholder="UG" /></Field>
          <Button type="submit">Add partner</Button>
        </form>
        <p className="text-xs text-ink-3 mt-4">Partners are the implementing organisations on the ground. Their introduction and contact appear on every funder page for wells assigned to them.</p>
      </Card>
    </div>
  );
}
