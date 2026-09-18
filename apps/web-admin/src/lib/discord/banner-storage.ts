import { randomUUID } from "node:crypto";
import { BANNER_IMAGE_TYPES, type BannerImageType } from "@repo/discord-message";
import { R2Storage } from "@repo/storage";
import { env } from "@/lib/env";

// Server-only. Banner images for the Discord message builder, in the shared
// CDN bucket. The bot only attaches uploads whose URL starts with the CDN
// base, so everything a banner points at has to come through here.

const PREFIX = "discord-banners";

let storage: R2Storage | null | undefined;

function getStorage(): R2Storage | null {
  if (storage !== undefined) return storage;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ASSETS_BUCKET } = env;
  storage =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ASSETS_BUCKET && env.NEXT_PUBLIC_CDN_URL
      ? new R2Storage({
          accountId: R2_ACCOUNT_ID,
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          bucket: R2_ASSETS_BUCKET,
        })
      : null;
  return storage;
}

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
