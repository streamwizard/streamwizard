import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentIndex, INDEX_COPY } from "@/components/public/cms/content-index";
import { cmsPublicEnabled } from "@/lib/cms/public";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog",
  description: INDEX_COPY.blog.description,
  alternates: { canonical: absoluteUrl("/blog") },
};

export default async function BlogPage() {
  if (!(await cmsPublicEnabled())) notFound();
  return <ContentIndex type="blog" />;
}
