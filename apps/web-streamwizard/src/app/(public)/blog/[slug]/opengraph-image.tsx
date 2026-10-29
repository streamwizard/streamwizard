import { renderContentOgImage } from "@/lib/cms/og";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

export const alt = "A StreamWizard blog post";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderContentOgImage("blog", slug);
}
