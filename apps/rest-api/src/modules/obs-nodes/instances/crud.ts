import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { countActiveObsInstancesForNode, deleteObsInstanceForNode, getObsInstanceByIdForNode, insertObsInstance, listObsInstancesByNode, listRunningObsInstancesByNode, sumAllocatedVramForNode, updateObsInstanceByContainerIdForNode, updateObsInstanceForNode } from "@repo/supabase/queries/obs-nodes/instances";
import {
  getUserActiveSubscriptionId,
  isActiveSubscriptionOfUser,
  usersWithActiveSubscription,
} from "@repo/supabase/queries/subscriptions/subscriptions";
import { env } from "@/env";
import { launchSubscriptionId, unentitledInstanceIds } from "@/modules/obs-nodes/instances/cloud-obs-plan";
import { checkInstanceCreateToken, type CreateTokenCheck } from "@/modules/obs-nodes/instances/instance-create-token";
import type { InsertInstanceInput, UpdateInstanceInput } from "@/modules/obs-nodes/schemas";
import { instanceDeleted } from "@/modules/obs-nodes/instances/events";
import { encryptPassword, generateVncPassword } from "@/modules/obs-nodes/instances/secrets";

// Every function here is scoped to the calling node: nodeId always comes from
// the node's API key (obsNodeAuth), never from the request.

export function listInstances(nodeId: string) {
  return listObsInstancesByNode(supabase, nodeId);
}

export function getAllocatedVram(nodeId: string): Promise<number> {
  return sumAllocatedVramForNode(supabase, nodeId);
}

export function countActiveInstances(nodeId: string): Promise<number> {
  return countActiveObsInstancesForNode(supabase, nodeId);
}

// Running instances on this node whose owner has lost their Cloud OBS plan.
// The node polls this and stops them, which covers a grant that simply
// expires (no event fires for that) and backs up the stop web-admin sends on
// revoke. A lookup failure throws (a 500), never an empty "stop nothing" or a
// full "stop everything" answer.
export async function listUnentitledInstances(nodeId: string): Promise<string[]> {
  const running = await listRunningObsInstancesByNode(supabase, nodeId);
  return unentitledInstanceIds(running, (userIds) => usersWithActiveSubscription(supabase, userIds, "cloud_obs"));
}

/** One of the node's instances; the optional userId further narrows it. null when there is no match. */
export async function getInstance(nodeId: string, id: string, userId?: string) {
  const instance = await getObsInstanceByIdForNode(supabase, id, nodeId);
  if (!instance || (userId && instance.user_id !== userId)) return null;
  return instance;
}

export type CreateInstanceResult =
  | { ok: true; instance: Awaited<ReturnType<typeof insertObsInstance>> }
  | { ok: false; reason: "create_token"; tokenCheck: Extract<CreateTokenCheck, { ok: false }> }
  | { ok: false; reason: "subscription_inactive" | "failed" };

export async function createInstance(input: {
  nodeId: string;
  fields: InsertInstanceInput;
  /** The X-Node-Token header: the user's own instances:create token. */
  createToken: string | undefined;
}): Promise<CreateInstanceResult> {
  const { nodeId, createToken } = input;
  const { obs_ws_password: obsWsPassword, ...fields } = input.fields;
  const { user_id: userId, subscription_id: subscriptionId } = fields;

  // user_id comes from the node, so it has to be backed by the user's own
  // launch token. See ./instance-create-token.ts.
  const tokenCheck = await checkInstanceCreateToken({
    token: createToken,
    nodeId,
    userId,
    jwks: env.NODE_TOKEN_PUBLIC_JWKS,
  });
  if (!tokenCheck.ok) return { ok: false, reason: "create_token", tokenCheck };

  const planSubscriptionId = await launchSubscriptionId(userId, subscriptionId, {
    isOwnActivePlan: (id, owner) => isActiveSubscriptionOfUser(supabase, id, owner, "cloud_obs"),
    activePlanOf: (owner) => getUserActiveSubscriptionId(supabase, owner, "cloud_obs"),
  });
  if (!planSubscriptionId) {
    return { ok: false, reason: "subscription_inactive" };
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
      subscription_id: planSubscriptionId,
      node_id: nodeId,
      obs_ws_password_ciphertext: obsWs.ciphertext,
      obs_ws_password_iv: obsWs.iv,
      obs_ws_password_tag: obsWs.tag,
      vnc_password_ciphertext: vnc.ciphertext,
      vnc_password_iv: vnc.iv,
      vnc_password_tag: vnc.tag,
    });
    return { ok: true, instance };
  } catch (err) {
    // Never the raw DB error: a constraint name or detail would tell the node
    // whether an id exists on another node.
    reportError(err, "obs-nodes.instances.create", { nodeId });
    return { ok: false, reason: "failed" };
  }
}

export type InstanceWriteFailure = "not_found" | "failed";

type UpdatedInstance = NonNullable<Awaited<ReturnType<typeof updateObsInstanceForNode>>>;

export async function updateInstance(
  nodeId: string,
  id: string,
  fields: UpdateInstanceInput,
): Promise<{ ok: true; instance: UpdatedInstance } | { ok: false; reason: InstanceWriteFailure }> {
  try {
    const instance = await updateObsInstanceForNode(supabase, id, nodeId, fields);
    if (!instance) return { ok: false, reason: "not_found" };
    return { ok: true, instance };
  } catch (err) {
    // Never the raw DB error: a constraint name or detail would tell the node
    // whether an id exists on another node.
    reportError(err, "obs-nodes.instances.update", { nodeId });
    return { ok: false, reason: "failed" };
  }
}

/** null when no instance of this node runs in that container. */
export function updateInstanceByContainer(nodeId: string, containerId: string, fields: UpdateInstanceInput) {
  return updateObsInstanceByContainerIdForNode(supabase, containerId, nodeId, fields);
}

export async function deleteInstance(nodeId: string, id: string): Promise<{ ok: true } | { ok: false; reason: InstanceWriteFailure }> {
  try {
    const deleted = await deleteObsInstanceForNode(supabase, id, nodeId);
    if (!deleted) return { ok: false, reason: "not_found" };
    instanceDeleted(nodeId, id, deleted.user_id);
    return { ok: true };
  } catch (err) {
    // Never the raw DB error: a constraint name or detail would tell the node
    // whether an id exists on another node.
    reportError(err, "obs-nodes.instances.delete", { nodeId });
    return { ok: false, reason: "failed" };
  }
}
