import { createOrganization } from "@/lib/admin/actions";
import { Button, Card, Field, Input } from "@/components/admin/ui";
import { countryName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Partners() {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id, name, country, type, wells(count)").order("name");
  type Row = { id: string; name: string; country: string | null; type: string; wells: { count: number }[] };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title="Organizations">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-3"><tr className="[&>th]:pb-2"><th>Name</th><th>Country</th><th>Type</th><th className="text-right">Wells</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr key={o.id} className="[&>td]:py-2">
                <td className="font-semibold">{o.name}</td><td>{o.country ? countryName(o.country) : "—"}</td><td className="text-ink-2">{o.type}</td>
                <td className="text-right tnum">{o.wells[0]?.count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Add a partner">
        <form action={createOrganization} className="flex flex-col gap-3">
          <Field label="Name"><Input name="name" required placeholder="Busoga Trust Drilling" /></Field>
          <Field label="Country code"><Input name="country" maxLength={2} placeholder="UG" /></Field>
          <Button type="submit">Add partner</Button>
        </form>
        <p className="text-xs text-ink-3 mt-4">Partners are the drilling teams on the ground. Assigning a well to a partner is what will let their people see it if we switch on partner access later.</p>
      </Card>
    </div>
  );
}
