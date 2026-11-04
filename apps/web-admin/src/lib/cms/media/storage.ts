import type { R2Storage } from "@repo/storage";
import { getPublicAssetsStorage } from "@/lib/assets-storage";
import { env } from "@/lib/env";

// Server-only. CMS images in the shared CDN bucket under cms/. The browser
// uploads straight to R2 with a presigned PUT: the image never passes through
// this server. That needs the bucket's CORS rules to allow web-admin's origin
// and the R2 host in connect-src (src/lib/csp.ts).

const getStorage = getPublicAssetsStorage;

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
