import { reportError } from "@repo/sentry";
import { env } from "@/env";
import { getStorageCredentials, sharedStoragePolicy } from "@/modules/obs-nodes/storage-credentials";

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
export async function issueSharedStorageCredentials(nodeId: string) {
  try {
    const creds = await getStorageCredentials(`${nodeId}:shared`, () => sharedStoragePolicy(env.OBS_S3_BUCKET));
    return { ok: true as const, creds };
  } catch (err) {
    reportError(err, "obs-nodes.storage-credentials.shared", { nodeId });
    return { ok: false as const };
  }
}
