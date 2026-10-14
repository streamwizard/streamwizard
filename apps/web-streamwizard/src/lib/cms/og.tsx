import { ImageResponse } from "next/og";
import type { ContentType } from "@repo/cms";
import { OG_SIZE, renderOgImage } from "@/lib/og-image";
import { cmsImageUrl } from "./images";
import { cmsPublicEnabled, getPublishedPost } from "./public";
import { shareImage, splitTitle } from "./published";

// The share card of one post or guide: the OG image uploaded for it, or else
// the site's card with the post's title. Satori can't draw WebP or GIF, so
// only a PNG or JPEG upload is used as is.

const DRAWABLE = new Set(["image/png", "image/jpeg"]);
const LEVELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as Record<string, string>;

export async function renderContentOgImage(type: ContentType, slug: string) {
  const row = (await cmsPublicEnabled()) ? await getPublishedPost(type, slug) : null;
  if (!row) {
    return renderOgImage({ eyebrow: "StreamWizard", title: ["Nothing here.", "Try the blog or guides."], subline: "" });
  }

  const upload = row.og_image ? shareImage({ ...row, cover: null }) : null;
  if (upload && upload.mimeType && DRAWABLE.has(upload.mimeType)) {
    return new ImageResponse(
      // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img>
      <img
        src={cmsImageUrl(upload.key)}
        alt=""
        width={OG_SIZE.width}
        height={OG_SIZE.height}
        style={{ objectFit: "cover" }}
      />,
      OG_SIZE,
    );
  }

  const guide = type === "guide";
  const level = guide && row.difficulty ? LEVELS[row.difficulty] : null;
  return renderOgImage({
    eyebrow: guide ? "Guide" : "Blog",
    title: splitTitle(row.title),
    subline: [level, `${row.reading_time_minutes} min read`].filter(Boolean).join(" · "),
  });
}
