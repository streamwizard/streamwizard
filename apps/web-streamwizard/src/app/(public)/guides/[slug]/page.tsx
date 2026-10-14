import type { Metadata } from "next";
import { ContentDetail, contentMetadata } from "@/components/public/cms/content-detail";

type Props = { params: Promise<{ slug: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return contentMetadata("guide", params);
}

export default function GuidesPostPage({ params }: Props) {
  return <ContentDetail type="guide" params={params} />;
}
