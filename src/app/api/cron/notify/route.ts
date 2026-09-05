import { NextResponse, type NextRequest } from "next/server";
import { runNotifications } from "@/lib/email/notify";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hit hourly by the scheduler with Authorization: Bearer $CRON_SECRET. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ skipped: "RESEND_API_KEY not set" });
  try {
    const result = await runNotifications();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
