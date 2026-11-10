import { randomUUID } from "node:crypto";
import { BANNER_IMAGE_TYPES, type BannerImageType } from "@repo/discord-message";
import { getPublicAssetsStorage } from "@/lib/assets-storage";
import { env } from "@/lib/env";

// Server-only. Banner images for the Discord message builder, in the shared
// CDN bucket. The bot only attaches uploads whose URL starts with the CDN
// base, so everything a banner points at has to come through here.

const PREFIX = "discord-banners";

const getStorage = getPublicAssetsStorage;

export const bannerUploadsEnabled = (): boolean => getStorage() !== null;

const cdnBase = (): string | null => (env.NEXT_PUBLIC_CDN_URL ? `${env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, "")}/` : null);

/** Whether a banner URL is one of our own uploads. */
export function isBannerUploadUrl(url: string): boolean {
  const base = cdnBase();
  return base !== null && url.startsWith(`${base}${PREFIX}/`);
}

/** Stores the image and returns its public URL. Callers have checked type and size. */
export async function storeBannerImage(guildId: string, type: BannerImageType, bytes: Uint8Array): Promise<string> {
  const r2 = getStorage();
  const base = cdnBase();
  if (!r2 || !base) throw new Error("Banner uploads aren't configured");
  // Random segment: the bucket is served publicly, so keys mustn't be guessable.
  const key = `${PREFIX}/${guildId}/${randomUUID()}.${BANNER_IMAGE_TYPES[type]}`;
  await r2.putObject(key, bytes, type);
  return `${base}${key}`;
}
