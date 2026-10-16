import type { Metadata } from "next";
import { ContentIndex, contentIndexMetadata } from "@/components/public/cms/content-index";
import type { RawSearchParams } from "@/lib/cms/filters";

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return contentIndexMetadata("blog", await searchParams);
}

export default async function BlogPage({ searchParams }: Props) {
  return <ContentIndex type="blog" searchParams={await searchParams} />;
}
