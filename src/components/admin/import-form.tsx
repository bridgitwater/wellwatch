"use client";

import { useActionState } from "react";
import type { ImportResult } from "@/lib/admin/import";
import { Button } from "./ui";

export function ImportForm({ action, label }: { action: (prev: ImportResult | null, fd: FormData) => Promise<ImportResult>; label: string }) {
  const [state, act, pending] = useActionState<ImportResult | null, FormData>(action, null);
  return (
    <form action={act} className="flex flex-col gap-3">
      <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
      <div><Button type="submit" disabled={pending}>{pending ? "Importing…" : label}</Button></div>
      {state && (state.ok ? (
        <div className="text-sm">
          <p className="text-ok font-semibold">{state.message}</p>
          {state.skipped && state.skipped.length > 0 && (
            <ul className="mt-2 text-xs text-clay list-disc pl-4 max-h-48 overflow-y-auto">{state.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>
          )}
        </div>
      ) : <p className="text-sm text-clay">{state.error}</p>)}
    </form>
  );
}
