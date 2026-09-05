import { WellForm } from "@/components/admin/well-form";
import { Card } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";

export default async function NewWell() {
  const supabase = await createClient();
  const { data: orgs } = await supabase.from("organizations").select("id, name").eq("type", "partner").order("name");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">New well</h1>
      <Card title="Details">
        <p className="text-sm text-ink-2 mb-4">Creating the well also creates its folder in the Wells drive and marks it as funded today. You can add funders, costs and stages afterwards.</p>
        <WellForm orgs={orgs ?? []} />
      </Card>
    </div>
  );
}
