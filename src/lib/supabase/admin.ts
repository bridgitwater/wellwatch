import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS — server-only, never import from client code.
 * Used by the Drive sync job, notifications and admin invitations.
 *
 * The Authorization header is pinned to the service-role key. Without this,
 * supabase-js resolves the header per request from its (empty) auth session,
 * and under parallel requests one of them could go out without a usable
 * bearer token and get a 401 from PostgREST.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${key}`, apikey: key } },
  });
}

/**
 * Turns anything thrown or returned as an error (Error, PostgrestError plain
 * object, string, …) into a readable message instead of "[object Object]".
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.code && `code=${o.code}`, o.details, o.hint]
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (parts.length) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      /* fall through */
    }
  }
  return String(e);
}

/**
 * Runs `fn` up to `attempts` times with exponential backoff (500ms, 1s, 2s…).
 * A PostgREST result with `error` set counts as a failure and is retried.
 */
export async function withRetry<T extends { error: unknown }>(
  label: string,
  fn: () => PromiseLike<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn();
      if (!res.error) return res;
      lastErr = res.error;
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${errorMessage(lastErr)}`);
}

/**
 * Reads a whole table (or filtered set) in pages, so results aren't silently
 * truncated by PostgREST's default 1,000-row cap. `query` builds a fresh query
 * each call; ordering by `orderBy` keeps pages stable.
 */
export async function selectAll<Row>(
  label: string,
  query: () => {
    order: (col: string, opts?: { ascending?: boolean }) => {
      range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>;
    };
  },
  orderBy = "id",
  pageSize = 1000,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const res = await withRetry(`${label} (rows ${from}–${from + pageSize - 1})`, () =>
      query().order(orderBy, { ascending: true }).range(from, from + pageSize - 1),
    );
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}
