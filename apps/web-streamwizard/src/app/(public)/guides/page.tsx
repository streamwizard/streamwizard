import type { Metadata } from "next";
import { ContentIndex, INDEX_COPY } from "@/components/public/cms/content-index";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Guides",
  description: INDEX_COPY.guide.description,
  alternates: { canonical: absoluteUrl("/guides") },
};

export default function GuidesPage() {
  return <ContentIndex type="guide" />;
}
