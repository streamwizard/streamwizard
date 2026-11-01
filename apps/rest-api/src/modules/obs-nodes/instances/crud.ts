import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import {
  countActiveObsInstancesForNode,
  deleteObsInstanceForNode,
  getObsInstanceByIdForNode,
  insertObsInstance,
  listObsInstancesByNode,
  listRunningObsInstancesByNode,
  sumAllocatedVramForNode,
  updateObsInstanceByContainerIdForNode,
  updateObsInstanceForNode,
} from "@repo/supabase/queries/obs-nodes";
import { isActiveSubscriptionOfUser, usersWithActiveSubscription } from "@repo/supabase/queries/subscriptions";
import { env } from "../../../env";
import { unentitledInstanceIds } from "./cloud-obs-plan";
import { checkInstanceCreateToken } from "./instance-create-token";
import { insertInstanceSchema, updateInstanceSchema } from "../../../schemas/obs-nodes";
import { encryptPassword, generateVncPassword } from "./secrets";

export async function listInstances(c: Context) {
  const nodeId = c.get("nodeId");
  const rows = await listObsInstancesByNode(supabase, nodeId);
  return c.json(rows);
}

export async function getAllocatedVram(c: Context) {
  const nodeId = c.get("nodeId");
  const total = await sumAllocatedVramForNode(supabase, nodeId);
  return c.json({ total_vram_mb: total });
}

export async function countActiveInstances(c: Context) {
  const nodeId = c.get("nodeId");
  const count = await countActiveObsInstancesForNode(supabase, nodeId);
  return c.json({ count });
}

// Running instances on this node whose owner has lost their Cloud OBS plan.
// The node polls this and stops them, which covers a grant that simply
// expires (no event fires for that) and backs up the stop web-admin sends on
// revoke. A lookup failure is a 500, never an empty "stop nothing" or a full
// "stop everything" answer.
export async function listUnentitledInstances(c: Context) {
  const nodeId = c.get("nodeId");
  const running = await listRunningObsInstancesByNode(supabase, nodeId);
  const ids = await unentitledInstanceIds(running, (userIds) =>
    usersWithActiveSubscription(supabase, userIds, "cloud_obs"),
  );
  return c.json({ instance_ids: ids });
}

export async function getInstance(c: Context<Env, "/:id">) {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");
  const userId = c.req.query("user_id");
  // Always scoped to the calling node; the optional user_id further narrows it.
  const instance = await getObsInstanceByIdForNode(supabase, id, nodeId);
  if (!instance || (userId && instance.user_id !== userId)) {
    return c.json({ error: "Instance not found" }, 404);
  }
  return c.json(instance);
}

export async function createInstance(c: Context) {
  const nodeId = c.get("nodeId");
  const parsed = insertInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid instance payload", details: parsed.error.flatten() }, 400);
  }
  const { obs_ws_password: obsWsPassword, ...fields } = parsed.data;
  const { user_id: userId, subscription_id: subscriptionId } = fields;

  // user_id comes from the node, so it has to be backed by the user's own
  // launch token. See ./instance-create-token.ts.
  const tokenCheck = await checkInstanceCreateToken({
    token: c.req.header("X-Node-Token"),
    nodeId,
    userId,
    jwks: env.NODE_TOKEN_PUBLIC_JWKS,
    required: env.NODE_CREATE_TOKEN_REQUIRED,
  });
  if (!tokenCheck.ok) return c.json({ error: tokenCheck.error }, tokenCheck.status);

  if (subscriptionId && !(await isActiveSubscriptionOfUser(supabase, subscriptionId, userId))) {
    return c.json({ error: "Subscription not found or inactive" }, 403);
  }

  // Both passwords are encrypted here, never by the node: the node holds no
  // encryption key and gets the plaintext back from GET /instances/:id/secrets.
  // The VNC password is generated here too; it's only ever used between the
  // node's noVNC proxy and the container.
  const obsWs = encryptPassword(obsWsPassword);
  const vnc = encryptPassword(generateVncPassword());

  try {
    // node_id is forced to the authenticated node, never taken from the body.
    const instance = await insertObsInstance(supabase, {
      ...fields,
      node_id: nodeId,
      obs_ws_password_ciphertext: obsWs.ciphertext,
      obs_ws_password_iv: obsWs.iv,
      obs_ws_password_tag: obsWs.tag,
      vnc_password_ciphertext: vnc.ciphertext,
      vnc_password_iv: vnc.iv,
      vnc_password_tag: vnc.tag,
    });
    return c.json(instance, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
}

export async function updateInstance(c: Context<Env, "/:id">) {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");
  const parsed = updateInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid instance payload", details: parsed.error.flatten() }, 400);
  }
  try {
    const instance = await updateObsInstanceForNode(supabase, id, nodeId, parsed.data);
    if (!instance) return c.json({ error: "Instance not found" }, 404);
    return c.json(instance);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
}

export async function updateInstanceByContainer(c: Context<Env, "/by-container/:containerId">) {
  const nodeId = c.get("nodeId");
  const containerId = c.req.param("containerId");
  const parsed = updateInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid instance payload", details: parsed.error.flatten() }, 400);
  }
  const instance = await updateObsInstanceByContainerIdForNode(supabase, containerId, nodeId, parsed.data);
  if (!instance) return c.json({ error: "Instance not found" }, 404);
  return c.json(instance);
}

export async function deleteInstance(c: Context<Env, "/:id">) {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");
  try {
    const deleted = await deleteObsInstanceForNode(supabase, id, nodeId);
    if (!deleted) return c.json({ error: "Instance not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
}
