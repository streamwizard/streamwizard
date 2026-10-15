import type { Metadata } from "next";
import { ContentIndex, INDEX_COPY } from "@/components/public/cms/content-index";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog",
  description: INDEX_COPY.blog.description,
  alternates: { canonical: absoluteUrl("/blog") },
};

export default function BlogPage() {
  return <ContentIndex type="blog" />;
}
