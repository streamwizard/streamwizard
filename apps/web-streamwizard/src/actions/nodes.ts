"use server";

import { randomBytes, createHash, randomUUID } from "crypto";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions";
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
  getInstanceNodeApiUrl,
  getUserRunningInstance,
  getUserLatestInstance,
  pickAvailableNode,
} from "@repo/supabase/queries/obs-nodes";

const NODES_PATH = "/dashboard/admin/nodes";
const CLAIM_TOKEN_TTL_MS = 30 * 60 * 1000;

async function requireAdminContext() {
  const { user } = await getAuthContext();
  const adminClient = createAdminClient();
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Forbidden");
  return adminClient;
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

  const { rawToken, tokenHash } = generateClaimToken();
  const { data, error } = await createNode(adminClient, {
    ...fields,
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

  const { data, error } = await updateNodeCapacity(adminClient, id, fields);
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
// URL -- the VNC viewer page forwards this token-bearing URL into a
// WebSocket connection, so an attacker-controlled apiUrl in the query string
// would exfiltrate the admin's Supabase access token to an arbitrary host.
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

// Both user-facing actions below use the admin client so they can join across
// obs_instances and obs_nodes without requiring RLS policies on obs_nodes that
// would expose node data to end users. Ownership is enforced in the query
// predicate (user_id = userId) rather than via RLS.

export async function createInstanceAction(
  nodeId: string,
  options: { resolution?: string; template?: string } = {},
): Promise<{ data: ObsInstance | null; error: string | null }> {
  let supabase: Awaited<ReturnType<typeof getAuthContext>>["supabase"];
  let userId: string;
  try {
    const ctx = await getAuthContext();
    supabase = ctx.supabase;
    userId = ctx.user.id;
  } catch {
    return { data: null, error: "Unauthenticated" };
  }

  // Resolve the node's API URL server-side — never trust a client-supplied URL
  // because the fetch below attaches the user's Bearer token.
  const adminClient = createAdminClient();
  const node = await getNodeById(adminClient, nodeId);
  if (!node?.api_url) return { data: null, error: "Node not found or has no API URL." };
  const apiUrl = node.api_url;

  const obsWsPassword = randomUUID().replace(/-/g, "");
  const { encryptToken } = await import("@repo/supabase/crypto");
  const { ciphertext, iv, authTag } = encryptToken(obsWsPassword);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: "No active session." };

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
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { data: null, error: body.error ?? `Failed to create instance (${res.status})` };
  }

  const instance = (await res.json()) as ObsInstance;
  return { data: instance, error: null };
}

export async function getMyRunningInstanceAction(): Promise<{ data: ObsInstance | null; error: string | null }> {
  let userId: string;
  try {
    const { user } = await getAuthContext();
    userId = user.id;
  } catch {
    return { data: null, error: "Unauthenticated" };
  }
  const adminClient = createAdminClient();
  const instance = await getUserRunningInstance(adminClient, userId);
  return { data: instance, error: null };
}

// Looks up the node api_url for an instance the calling user owns.
// The api_url must come from a trusted server-side lookup -- the client
// appends a Bearer token to the WebSocket URL, so an attacker-controlled
// URL in the query string would exfiltrate that token to an arbitrary host.
export async function getInstanceNodeApiUrlAction(
  instanceId: string,
): Promise<{ data: { apiUrl: string } | null; error: string | null }> {
  let userId: string;
  try {
    const { user } = await getAuthContext();
    userId = user.id;
  } catch {
    return { data: null, error: "Unauthenticated" };
  }
  const adminClient = createAdminClient();
  const apiUrl = await getInstanceNodeApiUrl(adminClient, instanceId, userId);
  if (!apiUrl) return { data: null, error: "Instance not found or node has no API URL." };
  return { data: { apiUrl }, error: null };
}

export async function getInstanceObsWsPasswordAction(
  instanceId: string,
): Promise<{ data: { password: string } | null; error: string | null }> {
  let userId: string;
  try {
    const { user } = await getAuthContext();
    userId = user.id;
  } catch {
    return { data: null, error: "Unauthenticated" };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("obs_instances")
    .select("obs_ws_password_ciphertext, obs_ws_password_iv, obs_ws_password_tag")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return { data: null, error: "Instance not found." };
  const { obs_ws_password_ciphertext: ciphertext, obs_ws_password_iv: iv, obs_ws_password_tag: tag } = data;
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

/** Returns the user's most recent instance regardless of status (e.g. stopped). */
export async function getMyLatestInstanceAction(): Promise<{ data: ObsInstance | null; error: string | null }> {
  let userId: string;
  try {
    const { user } = await getAuthContext();
    userId = user.id;
  } catch {
    return { data: null, error: "Unauthenticated" };
  }
  const adminClient = createAdminClient();
  const instance = await getUserLatestInstance(adminClient, userId);
  return { data: instance, error: null };
}

/**
 * Picks an available linked node and provisions a new OBS instance for the
 * calling user. Returns the new instance, node API URL, and OBS WS password.
 */
export async function launchMyInstanceAction(options: { resolution?: string; template?: string } = {}): Promise<{
  data: { instance: ObsInstance; apiUrl: string; password: string } | null;
  error: string | null;
}> {
  let supabase: Awaited<ReturnType<typeof getAuthContext>>["supabase"];
  let userId: string;
  try {
    const ctx = await getAuthContext();
    supabase = ctx.supabase;
    userId = ctx.user.id;
  } catch {
    return { data: null, error: "Unauthenticated" };
  }

  const adminClient = createAdminClient();

  const [node, subscriptionId] = await Promise.all([
    pickAvailableNode(adminClient),
    getUserActiveSubscriptionId(adminClient, userId, "cloud_obs"),
  ]);

  if (!node?.api_url) return { data: null, error: "No Cloud OBS capacity is available right now. Please try again later." };
  if (!subscriptionId) return { data: null, error: "No active Cloud OBS subscription found." };

  const obsWsPassword = randomUUID().replace(/-/g, "");
  const { encryptToken } = await import("@repo/supabase/crypto");
  const { ciphertext, iv, authTag } = encryptToken(obsWsPassword);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: "No active session." };

  const res = await fetch(`${node.api_url.replace(/\/$/, "")}/instances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...options,
      subscription_id: subscriptionId,
      obs_ws_password: obsWsPassword,
      obs_ws_password_ciphertext: ciphertext,
      obs_ws_password_iv: iv,
      obs_ws_password_tag: authTag,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { data: null, error: body.error ?? `Failed to launch instance (${res.status})` };
  }

  const instance = (await res.json()) as ObsInstance;
  return { data: { instance, apiUrl: node.api_url, password: obsWsPassword }, error: null };
}
