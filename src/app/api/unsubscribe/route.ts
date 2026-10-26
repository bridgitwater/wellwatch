import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * Turns WellWatch emails off (or back on with ?on=1) for the person the signed link
 * belongs to. POST only: mail apps' one-click unsubscribe (RFC 8058) POSTs here, and
 * so does the button on /unsubscribe. A GET never changes anything, because mail
 * scanners open every link they see.
 */
export async function POST(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const on = request.nextUrl.searchParams.get("on") === "1";
  if (!verifyUnsubscribe(u, t)) return NextResponse.json({ error: "invalid link" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ notify_email: on }).eq("id", u);
  if (error) return NextResponse.json({ error: "could not update" }, { status: 500 });

  // From our own page: go back to it showing the result. From a mail app: a plain 200.
  const fromPage = (request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")
    && !(await request.clone().text()).includes("List-Unsubscribe=One-Click");
  if (fromPage) {
    const back = new URL("/unsubscribe", request.nextUrl.origin);
    back.search = new URLSearchParams({ u, t, done: on ? "on" : "off" }).toString();
    return NextResponse.redirect(back, { status: 303 });
  }
  return NextResponse.json({ ok: true, emails: on ? "on" : "off" });
}

export function GET(request: NextRequest) {
  // Someone pasted the one-click URL into a browser: send them to the page with the button.
  const back = new URL("/unsubscribe", request.nextUrl.origin);
  back.search = request.nextUrl.search;
  return NextResponse.redirect(back, { status: 303 });
}
