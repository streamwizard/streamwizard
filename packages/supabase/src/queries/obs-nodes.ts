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

export type ObsInstance = Database["public"]["Tables"]["obs_instances"]["Row"];

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

/** Single instance with owner name/email, for the admin-only instance detail
 * page. Same two-query join as listInstancesByNodeWithOwner since
 * obs_instances.user_id has no FK to public.users. */
export async function getInstanceByIdWithOwner(
  client: DBClient,
  instanceId: string,
): Promise<ObsNodeInstanceDetail | null> {
  const { data: instance } = await client
    .from("obs_instances")
    .select("id, user_id, node_id, container_id, container_name, resolution, status, vram_allocated_mb, created_at")
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
