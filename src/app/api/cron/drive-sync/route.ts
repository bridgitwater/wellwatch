import { NextResponse, type NextRequest } from "next/server";
import { runDriveSync } from "@/lib/drive/sync";

export const maxDuration = 300; // seconds; Vercel Hobby allows up to 300 for cron-triggered functions
export const dynamic = "force-dynamic";

/** Vercel Cron hits this every 10 minutes (see vercel.json) with Authorization: Bearer $CRON_SECRET. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDriveSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
