import { R2Storage } from "@repo/storage";
import { env } from "@/lib/env";

// Server-only. CMS images in the shared CDN bucket under cms/. The browser
// uploads straight to R2 with a presigned PUT: the image never passes through
// this server. That needs the bucket's CORS rules to allow web-admin's origin
// and the R2 host in connect-src (src/lib/csp.ts).

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

export const cmsUploadsEnabled = (): boolean => getStorage() !== null;

export function requireCmsStorage(): R2Storage {
  const r2 = getStorage();
  if (!r2) throw new Error("CMS image uploads aren't configured (R2_* and NEXT_PUBLIC_CDN_URL)");
  return r2;
}

/** Public URL of a CMS image. Empty when the CDN isn't configured. */
export function cmsAssetUrl(key: string): string {
  const base = env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, "");
  return base ? `${base}/${key}` : "";
}
