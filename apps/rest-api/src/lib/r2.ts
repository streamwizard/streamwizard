import { R2Storage } from "@repo/storage";
import { env } from "./env";

/** Shared R2 client for the asset bucket; null when the R2 env isn't set. */
export const r2 =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ASSETS_BUCKET
    ? new R2Storage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_ASSETS_BUCKET,
      })
    : null;
