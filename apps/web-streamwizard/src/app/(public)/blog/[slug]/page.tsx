import type { Metadata } from "next";
import { ContentDetail, contentMetadata } from "@/components/public/cms/content-detail";

type Props = { params: Promise<{ slug: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return contentMetadata("blog", params);
}

export default function BlogPostPage({ params }: Props) {
  return <ContentDetail type="blog" params={params} />;
}
