import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type ObsNode = Database["public"]["Tables"]["obs_nodes"]["Row"];

export interface ObsNodeCapacity {
  name: string;
  max_instances: number;
  memory_mb: number;
  cpu_quota: number;
  vram_mb: number;
  total_vram_mb: number;
  shm_size: string;
  api_url: string;
}

export interface ObsNodeInstanceOwner {
  id: string;
  user_id: string;
  container_name: string;
  status: string;
  owner_name: string | null;
  owner_email: string | null;
}

export interface ObsNodeInstanceDetail {
  id: string;
  user_id: string;
  node_id: string;
  container_id: string | null;
  container_name: string;
  resolution: string;
  status: string;
  vram_allocated_mb: number;
  memory_mb: number;
  cpu_quota: number;
  shm_size: string;
  subscription_id: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
}

export interface ObsNodeClaimFields {
  claim_token_hash: string;
  claim_token_expires_at: string;
}

export async function listNodes(client: DBClient): Promise<{ data: ObsNode[] | null; error: string | null }> {
  const { data, error } = await client.from("obs_nodes").select("*").order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getNodeById(client: DBClient, id: string): Promise<ObsNode | null> {
  const { data } = await client.from("obs_nodes").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function createNode(
  client: DBClient,
  fields: ObsNodeCapacity & ObsNodeClaimFields,
): Promise<{ data: ObsNode | null; error: string | null }> {
  const { data, error } = await client
    .from("obs_nodes")
    .insert({ ...fields, status: "pending" })
    .select("*")
    .single();
  return { data, error: error?.message ?? null };
}

export async function updateNodeCapacity(
  client: DBClient,
  id: string,
  fields: ObsNodeCapacity,
): Promise<{ data: ObsNode | null; error: string | null }> {
  const { data, error } = await client.from("obs_nodes").update(fields).eq("id", id).select("*").single();
  return { data, error: error?.message ?? null };
}

export async function deleteNode(client: DBClient, id: string): Promise<{ error: string | null }> {
  const { error } = await client.from("obs_nodes").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** Looks up by hash regardless of status, so an already-linked row from a
 * near-simultaneous replay is still found (lets the claim endpoint return 409
 * instead of a misleading 404). */
export async function claimNodeByTokenHash(client: DBClient, tokenHash: string): Promise<ObsNode | null> {
  const { data } = await client.from("obs_nodes").select("*").eq("claim_token_hash", tokenHash).maybeSingle();
  return data;
}

/** Atomically transitions a pending, unexpired node to linked in one UPDATE,
 * scoped by the same predicates the caller already checked. Under concurrent
 * claims with the same token, only the first UPDATE to acquire the row lock
 * actually matches -- once it commits (nulling claim_token_hash in the same
 * statement), every other concurrent UPDATE re-evaluates the WHERE clause
 * against that committed state and matches zero rows. Returns null if the
 * preconditions (hash match, not already linked, not expired) didn't hold by
 * the time this statement ran; the caller does a separate read-only lookup
 * only to pick the right error status code, never to decide the mutation. */
export async function consumeClaimToken(
  client: DBClient,
  tokenHash: string,
  gpuBusId: string,
): Promise<ObsNode | null> {
  const { data } = await client
    .from("obs_nodes")
    .update({
      status: "linked",
      gpu_bus_id: gpuBusId,
      claim_token_hash: null,
      claim_token_expires_at: null,
    })
    .eq("claim_token_hash", tokenHash)
    .neq("status", "linked")
    .gt("claim_token_expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  return data;
}

/** Instances currently provisioned on a node, joined with their owner's name/email
 * for the admin-only Nodes metrics view (end users never see other owners).
 * obs_instances.user_id has no FK to public.users (only to auth.users), so this
 * is two queries merged in app code rather than a single PostgREST embed. */
export async function listInstancesByNodeWithOwner(
  client: DBClient,
  nodeId: string,
): Promise<ObsNodeInstanceOwner[]> {
  const { data: instances } = await client
    .from("obs_instances")
    .select("id, user_id, container_name, status")
    .eq("node_id", nodeId);

  if (!instances || instances.length === 0) return [];

  const userIds = [...new Set(instances.map((i) => i.user_id))];
  const { data: owners } = await client.from("users").select("id, name, email").in("id", userIds);
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  return instances.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    container_name: row.container_name,
    status: row.status,
    owner_name: ownerById.get(row.user_id)?.name ?? null,
    owner_email: ownerById.get(row.user_id)?.email ?? null,
  }));
}

// ── Node API keys ────────────────────────────────────────────────────────────

export interface NodeApiKeyFields {
  key_hash: string;
  key_ciphertext: string;
  key_iv: string;
  key_tag: string;
}

/** Stores the SHA-256 hash and AES-256-GCM encrypted form of a node API key.
 *  The hash enables O(1) auth lookup; the ciphertext lets admins retrieve/rotate
 *  the key — matching the Twitch token / OBS WS password storage pattern. */
export async function insertNodeApiKey(
  client: DBClient,
  nodeId: string,
  fields: NodeApiKeyFields,
): Promise<void> {
  const { error } = await client.from("obs_node_api_keys").insert({ node_id: nodeId, ...fields });
  if (error) throw error;
}

/** Returns the node_id for the given key hash, or null if not found.
 *  Used by nodeAuth middleware on every authenticated node request. */
export async function lookupNodeByApiKeyHash(
  client: DBClient,
  keyHash: string,
): Promise<string | null> {
  const { data } = await client
    .from("obs_node_api_keys")
    .select("node_id")
    .eq("key_hash", keyHash)
    .maybeSingle();
  return data?.node_id ?? null;
}

export type ObsInstance = Database["public"]["Tables"]["obs_instances"]["Row"];
type ObsInstanceInsert = Database["public"]["Tables"]["obs_instances"]["Insert"];
type ObsInstanceUpdate = Database["public"]["Tables"]["obs_instances"]["Update"];

/** Returns the most recent running instance for the given user, or null. */
export async function getUserRunningInstance(client: DBClient, userId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Returns the most recent instance for the user regardless of status, or null. */
export async function getUserLatestInstance(client: DBClient, userId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Returns the first linked node that still has instance capacity, or null. */
export async function pickAvailableNode(client: DBClient): Promise<ObsNode | null> {
  const { data: nodes } = await client
    .from("obs_nodes")
    .select("*")
    .eq("status", "linked")
    .order("created_at", { ascending: true });
  if (!nodes?.length) return null;

  for (const node of nodes) {
    const { count } = await client
      .from("obs_instances")
      .select("id", { count: "exact", head: true })
      .eq("node_id", node.id)
      .in("status", ["creating", "running"]);
    if ((count ?? 0) < node.max_instances) return node;
  }
  return null;
}

/** Looks up the node api_url for an instance the calling user owns.
 * Returns null if the instance doesn't exist or belongs to a different user. */
export async function getInstanceNodeApiUrl(
  client: DBClient,
  instanceId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await client
    .from("obs_instances")
    .select("node_id, obs_nodes(api_url)")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const node = Array.isArray(data.obs_nodes) ? data.obs_nodes[0] : data.obs_nodes;
  return node?.api_url ?? null;
}

// ── Instance CRUD (used by node-authenticated API endpoints) ─────────────────

export async function listObsInstancesByNode(client: DBClient, nodeId: string): Promise<ObsInstance[]> {
  const { data, error } = await client
    .from("obs_instances")
    .select("*")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listObsInstancesByUser(client: DBClient, userId: string): Promise<ObsInstance[]> {
  const { data, error } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getObsInstanceById(client: DBClient, instanceId: string, userId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getObsInstanceByIdForNode(client: DBClient, instanceId: string): Promise<ObsInstance | null> {
  const { data } = await client.from("obs_instances").select("*").eq("id", instanceId).maybeSingle();
  return data;
}

export async function insertObsInstance(client: DBClient, fields: ObsInstanceInsert): Promise<ObsInstance> {
  const { data, error } = await client.from("obs_instances").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateObsInstance(client: DBClient, instanceId: string, fields: ObsInstanceUpdate): Promise<ObsInstance> {
  const { data, error } = await client
    .from("obs_instances")
    .update(fields)
    .eq("id", instanceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateObsInstanceByContainerId(
  client: DBClient,
  containerId: string,
  fields: ObsInstanceUpdate,
): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .update(fields)
    .eq("container_id", containerId)
    .select()
    .maybeSingle();
  return data;
}

export async function deleteObsInstance(client: DBClient, instanceId: string): Promise<void> {
  const { error } = await client.from("obs_instances").delete().eq("id", instanceId);
  if (error) throw error;
}

export async function sumAllocatedVramForNode(client: DBClient, nodeId: string): Promise<number> {
  const { data, error } = await client
    .from("obs_instances")
    .select("vram_allocated_mb")
    .eq("node_id", nodeId)
    .eq("status", "running");
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + r.vram_allocated_mb, 0);
}

export async function countActiveObsInstancesForNode(client: DBClient, nodeId: string): Promise<number> {
  const { count, error } = await client
    .from("obs_instances")
    .select("id", { count: "exact", head: true })
    .eq("node_id", nodeId)
    .in("status", ["creating", "running"]);
  if (error) throw error;
  return count ?? 0;
}

export async function isUserAdmin(client: DBClient, userId: string): Promise<boolean> {
  const { data } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ── Twitch integration (for stream key endpoint) ──────────────────────────────

export interface TwitchIntegration {
  twitch_user_id: string;
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_tag: string | null;
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  refresh_token_tag: string | null;
}

export async function getTwitchIntegration(client: DBClient, userId: string): Promise<TwitchIntegration | null> {
  const { data } = await client
    .from("integrations_twitch")
    .select(
      "twitch_user_id, access_token_ciphertext, access_token_iv, access_token_tag, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function updateTwitchTokens(
  client: DBClient,
  userId: string,
  fields: {
    access_token_ciphertext: string;
    access_token_iv: string;
    access_token_tag: string;
    refresh_token_ciphertext: string;
    refresh_token_iv: string;
    refresh_token_tag: string;
  },
): Promise<void> {
  await client.from("integrations_twitch").update(fields).eq("user_id", userId);
}

// ── Instance detail with owner (admin UI) ─────────────────────────────────────

/** Single instance with owner name/email, for the admin-only instance detail
 * page. Same two-query join as listInstancesByNodeWithOwner since
 * obs_instances.user_id has no FK to public.users. */
export async function getInstanceByIdWithOwner(
  client: DBClient,
  instanceId: string,
): Promise<ObsNodeInstanceDetail | null> {
  const { data: instance } = await client
    .from("obs_instances")
    .select("id, user_id, node_id, container_id, container_name, resolution, status, vram_allocated_mb, memory_mb, cpu_quota, shm_size, subscription_id, created_at")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) return null;

  const { data: owner } = await client.from("users").select("name, email").eq("id", instance.user_id).maybeSingle();

  return {
    ...instance,
    owner_name: owner?.name ?? null,
    owner_email: owner?.email ?? null,
  };
}
