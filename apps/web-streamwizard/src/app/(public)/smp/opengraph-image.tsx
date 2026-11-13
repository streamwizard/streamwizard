import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = "Minecraft SMP for Twitch streamers – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// The site's one social card layout, not the page's pixel theme. Title lines
// mirror the page's H1; the subline is the first sentence of its description.
export default function Image() {
  return renderOgImage({
    eyebrow: "Minecraft SMP",
    title: ["The Minecraft SMP", "your viewers can mess with."],
    subline: "A survival server where viewers hit you with jumpscares, disasters and loot crates.",
  });
}
