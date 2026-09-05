import { Card } from "@/components/admin/ui";
import { ImportForm } from "@/components/admin/import-form";
import { FUNDERS_CSV_COLUMNS, WELLS_CSV_COLUMNS } from "@/lib/admin/csv";
import { importFundersCsv, importWellsCsv } from "@/lib/admin/import";

export default function ImportPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="1. Import wells">
        <p className="text-sm text-ink-2 mb-3">
          One row per well. <code className="text-xs">code</code> and <code className="text-xs">name</code> are required; the rest are optional.
          Existing codes are updated, not duplicated. <code className="text-xs">partner</code> must match a partner&apos;s name exactly.
          <code className="text-xs"> status</code> can be one of funded, survey, drilling, pump_apron, water_flowing, handover.
        </p>
        <pre className="text-xs bg-bg rounded-md p-3 overflow-x-auto mb-4">{WELLS_CSV_COLUMNS.join(",")}</pre>
        <ImportForm action={importWellsCsv} label="Import wells" />
      </Card>
      <Card title="2. Import funders">
        <p className="text-sm text-ink-2 mb-3">
          One row per funder-to-well link. Creates the funder&apos;s account if it doesn&apos;t exist (no email is sent — they sign in whenever they first visit).
          <code className="text-xs"> is_primary</code> is yes/no.
        </p>
        <pre className="text-xs bg-bg rounded-md p-3 overflow-x-auto mb-4">{FUNDERS_CSV_COLUMNS.join(",")}</pre>
        <ImportForm action={importFundersCsv} label="Import funders" />
      </Card>
    </div>
  );
}
