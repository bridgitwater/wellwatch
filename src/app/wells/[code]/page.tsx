import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WellArticle } from "@/components/well-article";
import { getMyWells, getWellPage } from "@/lib/data";
import { WELL_TYPE_LABEL } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/wells/[code]">): Promise<Metadata> {
  const { code } = await params;
  const page = await getWellPage(code);
  return { title: page ? `${page.well.name} · ${WELL_TYPE_LABEL[page.well.well_type]}` : "Well" };
}

export default async function WellPage({ params }: PageProps<"/wells/[code]">) {
  const { code } = await params;
  const [page, mine] = await Promise.all([getWellPage(code), getMyWells()]);
  if (!page) notFound();
  return <WellArticle page={page} mode="funder" showBack={mine.length > 1} />;
}
