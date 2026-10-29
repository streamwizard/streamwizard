import type { Metadata } from "next";
import { ContentIndex, contentIndexMetadata } from "@/components/public/cms/content-index";
import type { RawSearchParams } from "@/lib/cms/filters";

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return contentIndexMetadata("guide", await searchParams);
}

export default async function GuidesPage({ searchParams }: Props) {
  return <ContentIndex type="guide" searchParams={await searchParams} />;
}
