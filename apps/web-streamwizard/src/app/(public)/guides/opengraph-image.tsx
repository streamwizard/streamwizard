import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Guides – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Lines mirror the page's H1 and description (components/public/cms/content-index.tsx).
export default function Image() {
  return renderOgImage({
    eyebrow: "Guides",
    title: ["Set it up once.", "Stream with it every night."],
    subline: "Step-by-step guides for overlays, alerts, clips and Cloud OBS.",
  });
}
