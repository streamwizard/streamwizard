"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { ADMIN_NODE_SCOPES, signNodeToken, type AdminNodeScope, type NodeTokenScope } from "@repo/node-token";
import { guidSchema } from "@repo/schemas/ids";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { toActionError, toDataError, type DataResult } from "@/lib/actions/action-error";
import { FORBIDDEN, tryAdminContext, type AdminContext } from "@/lib/auth/admin-context";
import { generateClaimToken, nodeInstallCommand } from "@/lib/nodes/claim-token";
import { obsNodeCapacitySchema } from "@/schemas/obs-node";
import { type ObsNode, type ObsNodeCapacity, type ObsNodeInstanceOwner, type ObsNodeInstanceDetail, listNodes, createNode, updateNodeCapacity, deleteNode, listInstancesByNodeWithOwner, getNodeById } from "@repo/supabase/queries/obs-nodes/nodes";
import type { ObsInstance } from "@repo/supabase/queries/obs-nodes/instances";
import { getInstanceByIdWithOwner, getInstanceObsWsPasswordFields } from "@repo/supabase/queries/obs-nodes/instance-details";

const NODES_PATH = "/obs";
const CLAIM_TOKEN_TTL_MS = 30 * 60 * 1000;
const NODE_NOT_FOUND = "Node not found.";
const INSTANCE_NOT_FOUND = "Instance not found.";
const NO_API_URL = "Node not found or has no API URL.";
const AUTHORIZE_FAILED = "Couldn't authorize this request.";

const nodeIdSchema = guidSchema;
const instanceIdSchema = guidSchema;
const mintSchema = z.object({
  target: z.union([z.object({ instanceId: guidSchema }), z.object({ nodeId: guidSchema })]),
  scope: z.enum(ADMIN_NODE_SCOPES),
});
// Sent to the node as-is; it checks the values against what it offers.
const createInstanceSchema = z.object({
  nodeId: guidSchema,
  options: z.object({ resolution: z.string().min(1).max(32).optional(), template: z.string().min(1).max(100).optional() }),
});
const instanceTargetSchema = z.object({ nodeId: guidSchema, instanceId: guidSchema });

// Every call to an OBS node carries a 60-second node token instead of the
// admin's Supabase session: valid on that one node, for one action and, where
// it applies, one instance. role "admin" is only ever signed here, after
// assertAdmin() (admin role + strong session), and the node still checks the
// role against rest-api on top of it.
function signAdminNodeToken(userId: string, nodeId: string, scope: NodeTokenScope, instanceId?: string): Promise<string> {
  return signNodeToken({ nodeId, userId, scope, instanceId, role: "admin" });
}

// For the admin pages that call a node from the browser (ws-tickets for the
// metrics stream, noVNC and obsws). The node is resolved server-side: from
// the instance when there is one, so the token always names the node that
// actually hosts it.
export async function mintAdminNodeTokenAction(
  target: { instanceId: string } | { nodeId: string },
  scope: AdminNodeScope,
): Promise<DataResult<{ token: string }>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const parsed = mintSchema.safeParse({ target, scope });
  if (!parsed.success) return { data: null, error: "Invalid scope" };

  try {
    let nodeId: string;
    let instanceId: string | undefined;
    if ("instanceId" in parsed.data.target) {
      const instance = await getInstanceByIdWithOwner(ctx.adminClient, parsed.data.target.instanceId);
      if (!instance) return { data: null, error: INSTANCE_NOT_FOUND };
      nodeId = instance.node_id;
      instanceId = instance.id;
    } else {
      const node = await getNodeById(ctx.adminClient, parsed.data.target.nodeId);
      if (!node) return { data: null, error: NODE_NOT_FOUND };
      nodeId = node.id;
    }
    return { data: { token: await signAdminNodeToken(ctx.userId, nodeId, parsed.data.scope, instanceId) }, error: null };
  } catch (err) {
    return toDataError(err, "node-token.sign", AUTHORIZE_FAILED);
  }
}

export async function listNodesAction(): Promise<DataResult<ObsNode[]>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  try {
    return await listNodes(ctx.adminClient);
  } catch (err) {
    return toDataError(err, "obs-nodes.list", "Couldn't load the nodes. Try again?");
  }
}

export async function getNodeAction(id: string): Promise<DataResult<ObsNode>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const nodeId = nodeIdSchema.safeParse(id);
  if (!nodeId.success) return { data: null, error: NODE_NOT_FOUND };

  try {
    const node = await getNodeById(ctx.adminClient, nodeId.data);
    return { data: node, error: node ? null : NODE_NOT_FOUND };
  } catch (err) {
    return toDataError(err, "obs-nodes.get", "Couldn't load that node. Try again?", { nodeId: nodeId.data });
  }
}

export async function getInstanceAction(instanceId: string): Promise<DataResult<ObsNodeInstanceDetail>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const id = instanceIdSchema.safeParse(instanceId);
  if (!id.success) return { data: null, error: INSTANCE_NOT_FOUND };

  try {
    const instance = await getInstanceByIdWithOwner(ctx.adminClient, id.data);
    return { data: instance, error: instance ? null : INSTANCE_NOT_FOUND };
  } catch (err) {
    return toDataError(err, "obs-nodes.get-instance", "Couldn't load that instance. Try again?", { instanceId: id.data });
  }
}

export async function createNodeAction(
  fields: ObsNodeCapacity,
): Promise<DataResult<{ node: ObsNode; rawToken: string; installCommand: string }>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const parsed = obsNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const claim = generateClaimToken(CLAIM_TOKEN_TTL_MS);
    const { data, error } = await createNode(ctx.adminClient, {
      ...parsed.data,
      claim_token_hash: claim.tokenHash,
      claim_token_expires_at: claim.expiresAt,
    });
    if (error || !data) return { data: null, error: error ?? "Couldn't create that node." };

    revalidatePath(NODES_PATH);
    const installCommand = nodeInstallCommand("obs-instance-manager", env.STREAMWIZARD_API_URL, claim.rawToken);
    return { data: { node: data, rawToken: claim.rawToken, installCommand }, error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.create", "Couldn't create that node. Try again?");
  }
}

export async function updateNodeAction(id: string, fields: ObsNodeCapacity): Promise<DataResult<ObsNode>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const nodeId = nodeIdSchema.safeParse(id);
  if (!nodeId.success) return { data: null, error: NODE_NOT_FOUND };
  const parsed = obsNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    // A blank API URL on edit means "leave it alone", not "clear it": the node
    // filled that column in itself when it linked, and wiping it would make the
    // node unreachable from the panel until it re-reports.
    const { api_url, ...rest } = parsed.data;
    const { data, error } = await updateNodeCapacity(ctx.adminClient, nodeId.data, api_url === null ? rest : parsed.data);
    if (error) return { data: null, error };

    revalidatePath(NODES_PATH);
    return { data, error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.update", "Couldn't save that node. Try again?", { nodeId: nodeId.data });
  }
}

export async function listNodeInstancesAction(nodeId: string): Promise<DataResult<ObsNodeInstanceOwner[]>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const id = nodeIdSchema.safeParse(nodeId);
  if (!id.success) return { data: null, error: NODE_NOT_FOUND };

  try {
    return { data: await listInstancesByNodeWithOwner(ctx.adminClient, id.data), error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.list-instances", "Couldn't load the instances. Try again?", { nodeId: id.data });
  }
}

// The API URL of the node that hosts an instance, for the VNC viewer. It comes
// from the same instance row that sets the admin node token's aud
// (mintAdminNodeTokenAction), so the token is only ever sent to the node it
// names. Never from the query string: the URL gets a ticket appended and is
// dialed as a WebSocket. `expectedNodeId` (from the link) must match the
// instance's node, so a link naming another node fails before any token exists.
export async function getInstanceNodeApiUrlAction(instanceId: string, expectedNodeId: string): Promise<DataResult<{ apiUrl: string }>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const parsed = instanceTargetSchema.safeParse({ instanceId, nodeId: expectedNodeId });
  if (!parsed.success) return { data: null, error: "Instance not found on this node." };

  try {
    const instance = await getInstanceByIdWithOwner(ctx.adminClient, parsed.data.instanceId);
    if (!instance || instance.node_id !== parsed.data.nodeId) return { data: null, error: "Instance not found on this node." };
    const node = await getNodeById(ctx.adminClient, instance.node_id);
    if (!node?.api_url) return { data: null, error: NO_API_URL };

    return { data: { apiUrl: node.api_url }, error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.instance-api-url", "Couldn't find that node. Try again?", { instanceId: parsed.data.instanceId });
  }
}

/** The node's error message, or `fallback` when the body has none. */
async function nodeError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof body.error === "string" ? body.error : fallback;
}

export async function createInstanceAction(
  nodeId: string,
  options: { resolution?: string; template?: string } = {},
): Promise<DataResult<ObsInstance>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const parsed = createInstanceSchema.safeParse({ nodeId, options });
  if (!parsed.success) return { data: null, error: "Pick a node, resolution and template the node offers." };

  try {
    // Resolve the node's API URL server-side — never trust a client-supplied URL
    // because the fetch below attaches a node token for it.
    const node = await getNodeById(ctx.adminClient, parsed.data.nodeId);
    if (!node?.api_url) return { data: null, error: NO_API_URL };

    // Sent to the node in plaintext (it has to write it into OBS anyway).
    // rest-api encrypts it when the node stores the row; the node never sees
    // ciphertext or the encryption key.
    const obsWsPassword = randomUUID().replace(/-/g, "");

    let token: string;
    try {
      token = await signAdminNodeToken(ctx.userId, node.id, "instances:create");
    } catch (err) {
      return toDataError(err, "node-token.sign", AUTHORIZE_FAILED);
    }

    const res = await fetch(`${node.api_url.replace(/\/$/, "")}/instances`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...parsed.data.options, obs_ws_password: obsWsPassword }),
    });
    if (!res.ok) return { data: null, error: await nodeError(res, `Failed to create instance (${res.status})`) };

    return { data: (await res.json()) as ObsInstance, error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.create-instance", "Couldn't reach that node. Try again in a minute.", { nodeId: parsed.data.nodeId });
  }
}

// Admin-scoped instance lifecycle calls to obs-instance-manager. These used to
// run in the browser with the admin's raw access token; that let a session
// that had not passed the second factor (Twitch only) drive containers.
// Routing them through here puts them behind assertAdmin() like every other
// mutation, and the node only ever sees an admin:instances node token for
// this one instance.
async function callInstanceManagerAdmin(
  ctx: AdminContext,
  target: z.infer<typeof instanceTargetSchema>,
  path: string,
  method: "POST" | "DELETE",
): Promise<DataResult<Response>> {
  // Resolve the node's API URL server-side — never trust a client-supplied URL
  // because the fetch below attaches a node token for it.
  const node = await getNodeById(ctx.adminClient, target.nodeId);
  if (!node?.api_url) return { data: null, error: NO_API_URL };

  let token: string;
  try {
    token = await signAdminNodeToken(ctx.userId, node.id, "admin:instances", target.instanceId);
  } catch (err) {
    return toDataError(err, "node-token.sign", AUTHORIZE_FAILED);
  }

  const res = await fetch(`${node.api_url.replace(/\/$/, "")}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  return { data: res, error: null };
}

const toggleSchema = instanceTargetSchema.extend({ action: z.enum(["start", "stop"]) });

export async function toggleInstanceAdminAction(
  nodeId: string,
  instanceId: string,
  action: "start" | "stop",
): Promise<DataResult<{ status: string }>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const parsed = toggleSchema.safeParse({ nodeId, instanceId, action });
  if (!parsed.success) return { data: null, error: INSTANCE_NOT_FOUND };
  const { action: verb, ...target } = parsed.data;

  try {
    const { data: res, error } = await callInstanceManagerAdmin(ctx, target, `/admin/instances/${target.instanceId}/${verb}`, "POST");
    if (!res) return { data: null, error };
    if (!res.ok) return { data: null, error: await nodeError(res, `Failed to ${verb} container (${res.status})`) };
    return { data: (await res.json()) as { status: string }, error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.toggle-instance", "Couldn't reach that node. Try again in a minute.", { instanceId: target.instanceId });
  }
}

export async function removeInstanceAdminAction(nodeId: string, instanceId: string): Promise<{ error: string | null }> {
  const ctx = await tryAdminContext();
  if (!ctx) return { error: FORBIDDEN };
  const parsed = instanceTargetSchema.safeParse({ nodeId, instanceId });
  if (!parsed.success) return { error: INSTANCE_NOT_FOUND };

  try {
    const { data: res, error } = await callInstanceManagerAdmin(ctx, parsed.data, `/admin/instances/${parsed.data.instanceId}`, "DELETE");
    if (!res) return { error };
    if (!res.ok) return { error: await nodeError(res, `Failed to remove instance (${res.status})`) };
    return { error: null };
  } catch (err) {
    return toActionError(err, "obs-nodes.remove-instance", "Couldn't reach that node. Try again in a minute.", { instanceId: parsed.data.instanceId });
  }
}

// Decrypts an instance's OBS WebSocket password so the admin instance page can
// open an obsws session (scene list for the auto-switcher editor). Admin-only —
// no ownership predicate, authority comes from the role check.
export async function getInstanceObsWsPasswordAdminAction(instanceId: string): Promise<DataResult<{ password: string }>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const id = instanceIdSchema.safeParse(instanceId);
  if (!id.success) return { data: null, error: INSTANCE_NOT_FOUND };

  try {
    const fields = await getInstanceObsWsPasswordFields(ctx.adminClient, id.data);
    if (!fields) return { data: null, error: INSTANCE_NOT_FOUND };
    const { ciphertext, iv, tag } = fields;
    if (!ciphertext || !iv || !tag) return { data: null, error: "Password not set on this instance." };

    const { decryptToken } = await import("@repo/supabase/crypto");
    return { data: { password: decryptToken(ciphertext, iv, tag) }, error: null };
  } catch (err) {
    return toDataError(err, "obs-nodes.ws-password", "Couldn't read that instance's password.", { instanceId: id.data });
  }
}

export async function deleteNodeAction(id: string): Promise<{ error: string | null }> {
  const ctx = await tryAdminContext();
  if (!ctx) return { error: FORBIDDEN };
  const nodeId = nodeIdSchema.safeParse(id);
  if (!nodeId.success) return { error: NODE_NOT_FOUND };

  try {
    const { error } = await deleteNode(ctx.adminClient, nodeId.data);
    revalidatePath(NODES_PATH);
    return { error };
  } catch (err) {
    return toActionError(err, "obs-nodes.delete", "Couldn't delete that node. Try again?", { nodeId: nodeId.data });
  }
}
