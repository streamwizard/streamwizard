import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getObsInstanceOwnerForNode } from "@repo/supabase/queries/obs-nodes/instances";
import { env } from "@/env";
import { getStorageCredentials, instanceStoragePolicy, type StorageCredentials } from "@/modules/obs-nodes/storage-credentials";

/**
 * POST /api/obs-nodes/instances/:id/storage-credentials
 * → { access_key_id, secret_access_key, session_token, expires_at }
 *
 * Temporary MinIO credentials that only reach this instance's config and
 * media folders. The folders come from the instance row (its owner), never
 * from the node. "not_found" for a missing instance and for another node's
 * instance alike, so a node can't tell whether an id exists elsewhere.
 *
 * Never log the response body.
 */
export async function issueInstanceStorageCredentials(
  nodeId: string,
  id: string,
): Promise<{ ok: true; creds: StorageCredentials } | { ok: false; reason: "not_found" | "unavailable" }> {
  const userId = await getObsInstanceOwnerForNode(supabase, id, nodeId);
  if (!userId) return { ok: false, reason: "not_found" };

  try {
    const creds = await getStorageCredentials(`${nodeId}:${id}`, () =>
      instanceStoragePolicy(env.OBS_S3_BUCKET, userId, id),
    );
    return { ok: true, creds };
  } catch (err) {
    reportError(err, "obs-nodes.storage-credentials.instance", { nodeId });
    return { ok: false, reason: "unavailable" };
  }
}
