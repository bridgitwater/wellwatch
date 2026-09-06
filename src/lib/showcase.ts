import "server-only";
import { cache } from "react";
import { createAdminClient } from "./supabase/admin";
import { loadWellPage, type WellPage } from "./data";
import { type Well, WELL_COLUMNS } from "./types";

/**
 * A well published as a public example. Read with the service role (no visitor
 * session), gated on wells.showcase, and stripped of anything about the funder:
 * gift amount, dedication and the cost breakdown never leave the server.
 */
export const getShowcaseWell = cache(async function getShowcaseWell(code: string): Promise<WellPage | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("wells").select(WELL_COLUMNS).eq("code", code).eq("showcase", true).maybeSingle();
  if (error) throw error;
  const well = data as unknown as Well | null;
  if (!well) return null;
  const page = await loadWellPage(db, well);
  return {
    ...page,
    well: { ...page.well, dedication: null },
    funding: null,
    costs: [],
    cofunders: 0,
  };
});
