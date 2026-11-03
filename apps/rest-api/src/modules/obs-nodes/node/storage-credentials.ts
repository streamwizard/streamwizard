import type { Context } from "hono";
import { reportError } from "@repo/sentry";
import { env } from "@/env";
import { getStorageCredentials, sharedStoragePolicy } from "@/lib/obs-storage-credentials";

/**
 * POST /api/obs-nodes/storage-credentials
 * → { access_key_id, secret_access_key, session_token, expires_at }
 *
 * Temporary, read-only MinIO credentials for the files every node shares:
 * OBS templates and plugins. Per-instance folders need
 * POST /instances/:id/storage-credentials instead.
 *
 * Never log the response body.
 */
export async function getSharedStorageCredentials(c: Context) {
  c.header("Cache-Control", "no-store");
  const nodeId = c.get("nodeId");
  try {
    const creds = await getStorageCredentials(`${nodeId}:shared`, () => sharedStoragePolicy(env.OBS_S3_BUCKET));
    return c.json(creds);
  } catch (err) {
    reportError(err, "obs-nodes.storage-credentials.shared", { nodeId });
    return c.json({ error: "Could not issue storage credentials" }, 503);
  }
}
