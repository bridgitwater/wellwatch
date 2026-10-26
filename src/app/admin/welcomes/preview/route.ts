import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewFunderWelcome } from "@/lib/email/welcome";
import { esc } from "@/lib/email/send";

export const dynamic = "force-dynamic";

/**
 * Shows an admin exactly what a funder's welcome email will look like, without sending
 * anything. ?funder=<profile id> previews the email for all of that funder's wells not
 * yet welcomed (or all their wells, if every one has been); ?link=<well_funders id>
 * previews the email for that one well.
 */
export async function GET(request: NextRequest) {
  const me = await getProfile();
  if (!me || me.role !== "admin") return new NextResponse("Not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const db = createAdminClient();
  let ids: string[] = [];
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const link = uuid(sp.get("link"));
  const funder = uuid(sp.get("funder"));
  if (link) ids = [link];
  else if (funder) {
    const { data } = await db.from("well_funders").select("id, welcomed_at").eq("profile_id", funder);
    const rows = data ?? [];
    const pending = rows.filter((r) => !r.welcomed_at);
    ids = (pending.length ? pending : rows).map((r) => r.id);
  }
  const p = await previewFunderWelcome(ids);
  if (!p) return new NextResponse("Nothing to preview", { status: 404 });

  const banner = `<div style="background:#fff7e6;border-bottom:1px solid #f0d9a8;padding:12px 20px;font:14px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#5a4410">
<strong>Preview only, nothing has been sent.</strong> To: ${esc(p.to)} · Subject: ${esc(p.subject)}<br>
In the real email the button is a one-time sign-in link for them, and the unsubscribe link works.</div>`;
  return new NextResponse(p.html.replace(/(<body[^>]*>)/, `$1${banner}`), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
