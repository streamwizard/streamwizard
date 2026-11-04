import type { Context, Env } from "hono";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getObsInstanceOwnerForNode } from "@repo/supabase/queries/obs-nodes";
import { env } from "@/env";
import { getStorageCredentials, instanceStoragePolicy } from "@/lib/obs-storage-credentials";
import { parseUuid } from "@/schemas/nodes-shared";

/**
 * POST /api/obs-nodes/instances/:id/storage-credentials
 * → { access_key_id, secret_access_key, session_token, expires_at }
 *
 * Temporary MinIO credentials that only reach this instance's config and
 * media folders. The folders come from the instance row (its owner), never
 * from the node. 404 for a missing instance and for another node's instance
 * alike, so a node can't tell whether an id exists elsewhere.
 *
 * Never log the response body.
 */
export async function getInstanceStorageCredentials(c: Context<Env, "/:id/storage-credentials">) {
  c.header("Cache-Control", "no-store");
  const nodeId = c.get("nodeId");
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json({ error: "Instance not found" }, 404);

  const userId = await getObsInstanceOwnerForNode(supabase, id, nodeId);
  if (!userId) return c.json({ error: "Instance not found" }, 404);

  try {
    const creds = await getStorageCredentials(`${nodeId}:${id}`, () =>
      instanceStoragePolicy(env.OBS_S3_BUCKET, userId, id),
    );
    return c.json(creds);
  } catch (err) {
    reportError(err, "obs-nodes.storage-credentials.instance", { nodeId });
    return c.json({ error: "Could not issue storage credentials" }, 503);
  }
}
