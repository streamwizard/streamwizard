import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentIndex, INDEX_COPY } from "@/components/public/cms/content-index";
import { cmsPublicEnabled } from "@/lib/cms/public";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Guides",
  description: INDEX_COPY.guide.description,
  alternates: { canonical: absoluteUrl("/guides") },
};

export default async function GuidesPage() {
  if (!(await cmsPublicEnabled())) notFound();
  return <ContentIndex type="guide" />;
}
