import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Blog – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Lines mirror the page's H1 and description (components/public/cms/content-index.tsx).
export default function Image() {
  return renderOgImage({
    eyebrow: "Blog",
    title: ["Notes from building", "StreamWizard"],
    subline: "What we shipped, why, and what we learned.",
  });
}
