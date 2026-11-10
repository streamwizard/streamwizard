import { R2Storage } from "@repo/storage";
import { env } from "@/lib/env";

// Server-only. The shared CDN bucket (R2_ASSETS_BUCKET) that CMS images,
// Discord banners and ticket attachments live in, each under its own prefix.

let storage: R2Storage | null | undefined;

/** The assets bucket, or null when the R2_* vars aren't set here. */
export function getAssetsStorage(): R2Storage | null {
  if (storage !== undefined) return storage;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ASSETS_BUCKET } = env;
  storage =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ASSETS_BUCKET
      ? new R2Storage({
          accountId: R2_ACCOUNT_ID,
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          bucket: R2_ASSETS_BUCKET,
        })
      : null;
  return storage;
}

/** The bucket for uploads the browser shows again, which need the public CDN URL too. */
export function getPublicAssetsStorage(): R2Storage | null {
  return env.NEXT_PUBLIC_CDN_URL ? getAssetsStorage() : null;
}
