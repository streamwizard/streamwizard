"use server";

import { randomBytes, createHash, randomUUID } from "crypto";
import { assertAdmin } from "@/lib/assert-admin";
import { isAdminNodeScope, signNodeToken, type AdminNodeScope, type NodeTokenScope } from "@repo/node-token";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { obsNodeCapacitySchema } from "@/schemas/obs-node";
import {
  type ObsNode,
  type ObsInstance,
  type ObsNodeCapacity,
  type ObsNodeInstanceOwner,
  type ObsNodeInstanceDetail,
  listNodes,
  createNode,
  updateNodeCapacity,
  deleteNode,
  listInstancesByNodeWithOwner,
  getNodeById,
  getInstanceByIdWithOwner,
  getInstanceObsWsPasswordFields,
} from "@repo/supabase/queries/obs-nodes";

const NODES_PATH = "/obs";
const CLAIM_TOKEN_TTL_MS = 30 * 60 * 1000;

async function requireAdminContext() {
  await assertAdmin();
  return createAdminClient();
}

// Every call to an OBS node carries a 60-second node token instead of the
// admin's Supabase session: valid on that one node, for one action and, where
// it applies, one instance. role "admin" is only ever signed here, after
// assertAdmin() (admin role + strong session), and the node still checks the
// role against rest-api on top of it.
async function requireAdminUserContext() {
  const userId = await assertAdmin();
  return { adminClient: createAdminClient(), userId };
}

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
): Promise<{ data: { token: string } | null; error: string | null }> {
  let adminClient, userId;
  try {
    ({ adminClient, userId } = await requireAdminUserContext());
  } catch {
    return { data: null, error: "Forbidden" };
  }
  if (!isAdminNodeScope(scope)) return { data: null, error: "Invalid scope" };

  let nodeId: string;
  let instanceId: string | undefined;
  if ("instanceId" in target) {
    const instance = await getInstanceByIdWithOwner(adminClient, target.instanceId);
    if (!instance) return { data: null, error: "Instance not found." };
    nodeId = instance.node_id;
    instanceId = instance.id;
  } else {
    const node = await getNodeById(adminClient, target.nodeId);
    if (!node) return { data: null, error: "Node not found." };
    nodeId = node.id;
  }

  try {
    return { data: { token: await signAdminNodeToken(userId, nodeId, scope, instanceId) }, error: null };
  } catch (err) {
    console.error("node token signing failed", err);
    return { data: null, error: "Couldn't authorize this request." };
  }
}

function generateClaimToken() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export async function listNodesAction(): Promise<{ data: ObsNode[] | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }
  return listNodes(adminClient);
}

export async function getNodeAction(id: string): Promise<{ data: ObsNode | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const node = await getNodeById(adminClient, id);
  return { data: node, error: node ? null : "Node not found." };
}

export async function getInstanceAction(
  instanceId: string,
): Promise<{ data: ObsNodeInstanceDetail | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const instance = await getInstanceByIdWithOwner(adminClient, instanceId);
  return { data: instance, error: instance ? null : "Instance not found." };
}

export async function createNodeAction(
  fields: ObsNodeCapacity,
): Promise<{ data: { node: ObsNode; rawToken: string; installCommand: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const parsed = obsNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { rawToken, tokenHash } = generateClaimToken();
  const { data, error } = await createNode(adminClient, {
    ...parsed.data,
    claim_token_hash: tokenHash,
    claim_token_expires_at: new Date(Date.now() + CLAIM_TOKEN_TTL_MS).toISOString(),
  });

  if (error || !data) return { data: null, error: error ?? "Couldn't create that node." };

  revalidatePath(NODES_PATH);
  const installCommand =
    `curl -fsSL https://raw.githubusercontent.com/streamwizard/obs-instance-manager/main/scripts/install.sh \\\n` +
    `  | sudo bash -s -- --rest-api-url=${env.STREAMWIZARD_API_URL} --token=${rawToken} --start`;
  return { data: { node: data, rawToken, installCommand }, error: null };
}

export async function updateNodeAction(
  id: string,
  fields: ObsNodeCapacity,
): Promise<{ data: ObsNode | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const parsed = obsNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // A blank API URL on edit means "leave it alone", not "clear it": the node
  // filled that column in itself when it linked, and wiping it would make the
  // node unreachable from the panel until it re-reports.
  const { api_url, ...rest } = parsed.data;
  const { data, error } = await updateNodeCapacity(adminClient, id, api_url === null ? rest : parsed.data);
  if (error) return { data: null, error };

  revalidatePath(NODES_PATH);
  return { data, error: null };
}

export async function listNodeInstancesAction(
  nodeId: string,
): Promise<{ data: ObsNodeInstanceOwner[] | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const data = await listInstancesByNodeWithOwner(adminClient, nodeId);
  return { data, error: null };
}

// Looks up a node's api_url server-side rather than trusting a client-supplied
// URL -- the VNC viewer page forwards this ticket-bearing URL into a
// WebSocket connection, so an attacker-controlled apiUrl in the query string
// would exfiltrate the ticket to an arbitrary host.
export async function getNodeApiUrlAction(
  nodeId: string,
): Promise<{ data: { apiUrl: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const node = await getNodeById(adminClient, nodeId);
  if (!node || !node.api_url) return { data: null, error: "Node not found or has no API URL." };

  return { data: { apiUrl: node.api_url }, error: null };
}

export async function createInstanceAction(
  nodeId: string,
  options: { resolution?: string; template?: string } = {},
): Promise<{ data: ObsInstance | null; error: string | null }> {
  let adminClient, userId;
  try {
    ({ adminClient, userId } = await requireAdminUserContext());
  } catch {
    return { data: null, error: "Forbidden" };
  }

  // Resolve the node's API URL server-side — never trust a client-supplied URL
  // because the fetch below attaches a node token for it.
  const node = await getNodeById(adminClient, nodeId);
  if (!node?.api_url) return { data: null, error: "Node not found or has no API URL." };
  const apiUrl = node.api_url;

  const obsWsPassword = randomUUID().replace(/-/g, "");
  const { encryptToken } = await import("@repo/supabase/crypto");
  const { ciphertext, iv, authTag } = encryptToken(obsWsPassword);

  let token: string;
  try {
    token = await signAdminNodeToken(userId, node.id, "instances:create");
  } catch (err) {
    console.error("node token signing failed", err);
    return { data: null, error: "Couldn't authorize this request." };
  }

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...options,
      obs_ws_password: obsWsPassword,
      obs_ws_password_ciphertext: ciphertext,
      obs_ws_password_iv: iv,
      obs_ws_password_tag: authTag,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { data: null, error: body.error ?? `Failed to create instance (${res.status})` };
  }

  const instance = (await res.json()) as ObsInstance;
  return { data: instance, error: null };
}

// Admin-scoped instance lifecycle calls to obs-instance-manager. These used to
// run in the browser with the admin's raw access token; that let a session
// that had not passed the second factor (Twitch only) drive containers.
// Routing them through here puts them behind assertAdmin() like every other
// mutation, and the node only ever sees an admin:instances node token for
// this one instance.
async function callInstanceManagerAdmin(
  nodeId: string,
  instanceId: string,
  path: string,
  method: "POST" | "DELETE",
): Promise<{ data: Response | null; error: string | null }> {
  let adminClient, userId;
  try {
    ({ adminClient, userId } = await requireAdminUserContext());
  } catch {
    return { data: null, error: "Forbidden" };
  }

  // Resolve the node's API URL server-side — never trust a client-supplied URL
  // because the fetch below attaches a node token for it.
  const node = await getNodeById(adminClient, nodeId);
  if (!node?.api_url) return { data: null, error: "Node not found or has no API URL." };

  let token: string;
  try {
    token = await signAdminNodeToken(userId, node.id, "admin:instances", instanceId);
  } catch (err) {
    console.error("node token signing failed", err);
    return { data: null, error: "Couldn't authorize this request." };
  }

  const res = await fetch(`${node.api_url.replace(/\/$/, "")}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return { data: res, error: null };
}

export async function toggleInstanceAdminAction(
  nodeId: string,
  instanceId: string,
  action: "start" | "stop",
): Promise<{ data: { status: string } | null; error: string | null }> {
  const { data: res, error } = await callInstanceManagerAdmin(nodeId, instanceId, `/admin/instances/${instanceId}/${action}`, "POST");
  if (!res) return { data: null, error };

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { data: null, error: body.error ?? `Failed to ${action} container (${res.status})` };
  }
  return { data: (await res.json()) as { status: string }, error: null };
}

export async function removeInstanceAdminAction(nodeId: string, instanceId: string): Promise<{ error: string | null }> {
  const { data: res, error } = await callInstanceManagerAdmin(nodeId, instanceId, `/admin/instances/${instanceId}`, "DELETE");
  if (!res) return { error };

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { error: body.error ?? `Failed to remove instance (${res.status})` };
  }
  return { error: null };
}

// Decrypts an instance's OBS WebSocket password so the admin instance page can
// open an obsws session (scene list for the auto-switcher editor). Admin-only —
// no ownership predicate, authority comes from the role check.
export async function getInstanceObsWsPasswordAdminAction(
  instanceId: string,
): Promise<{ data: { password: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const fields = await getInstanceObsWsPasswordFields(adminClient, instanceId);
  if (!fields) return { data: null, error: "Instance not found." };
  const { ciphertext, iv, tag } = fields;
  if (!ciphertext || !iv || !tag) return { data: null, error: "Password not set on this instance." };

  const { decryptToken } = await import("@repo/supabase/crypto");
  const password = decryptToken(ciphertext, iv, tag);
  return { data: { password }, error: null };
}

export async function deleteNodeAction(id: string): Promise<{ error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }

  const { error } = await deleteNode(adminClient, id);
  revalidatePath(NODES_PATH);
  return { error };
}
