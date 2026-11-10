import "server-only";

import { R2Storage } from "@repo/storage";
import { env } from "@/lib/env";

/** The media library's R2 bucket, or null where this environment has no R2 configured. */
export function getAssetsStorage(): R2Storage | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ASSETS_BUCKET) return null;
  return new R2Storage({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_ASSETS_BUCKET,
  });
}
