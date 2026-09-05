import { NextResponse } from "next/server";
import { renderCertificate } from "@/lib/certificate";
import { getProfile, getWellPage } from "@/lib/data";

export const dynamic = "force-dynamic";

/** PDF certificate. RLS guarantees the caller can only fetch wells they funded (or is admin). */
export async function GET(_req: Request, ctx: RouteContext<"/wells/[code]/certificate">) {
  const { code } = await ctx.params;
  const [profile, page] = await Promise.all([getProfile(), getWellPage(code)]);
  if (!profile || !page) return new NextResponse("Not found", { status: 404 });
  if (page.well.status !== "handover") return new NextResponse("This well is not complete yet.", { status: 409 });

  const pdf = await renderCertificate({
    well: page.well,
    stages: page.stages,
    funderName: profile.display_name ?? profile.email,
    cofunders: page.cofunders,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="BridgIT-${page.well.code}-certificate.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
