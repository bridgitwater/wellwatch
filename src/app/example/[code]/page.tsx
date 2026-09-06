import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WellArticle } from "@/components/well-article";
import { getShowcaseWell } from "@/lib/showcase";
import { countryName } from "@/lib/format";
import { WELL_TYPE_LABEL } from "@/lib/types";


export async function generateMetadata({ params }: PageProps<"/example/[code]">): Promise<Metadata> {
  const { code } = await params;
  const page = await getShowcaseWell(code);
  if (!page) return { title: "Example well" };
  const { well } = page;
  const title = `${well.name}, ${countryName(well.country)} — a finished BridgIT well`;
  const description = `${WELL_TYPE_LABEL[well.well_type]} serving ${well.people_served ?? "the"} people${well.households ? ` in ${well.households} households` : ""}. See the progress, photos and people behind it.`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "article", siteName: "WellWatch by BridgIT Water" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ExampleWellPage({ params }: PageProps<"/example/[code]">) {
  const { code } = await params;
  const page = await getShowcaseWell(code);
  if (!page) notFound();
  return <WellArticle page={page} mode="public" />;
}
