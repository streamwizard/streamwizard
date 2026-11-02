import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

type DBClient = SupabaseClient<Database>;

// ── Node API keys ────────────────────────────────────────────────────────────

// 'rest_api' — the node's own credential for calling the rest-api (obsNodeAuth).
// 'obs_command' — the key the obs-auto-switcher presents to the node's public
// /obs command route. Kept as distinct rows so a leaked command key can never
// authenticate as the node to the rest-api.
export type NodeApiKeyType = "rest_api" | "obs_command";

export interface EncryptedNodeKey {
  key_ciphertext: string;
  key_iv: string;
  key_tag: string;
}

// A rest_api key is only ever checked by its hash, so it has no encrypted
// copy (one would let TOKEN_ENCRYPTION_KEY rebuild the node's key). An
// obs_command key keeps one: the obs-auto-switcher decrypts it to call the
// node. The database enforces the same split (obs_node_api_keys_ciphertext_by_type).
export type NodeApiKeyFields =
  | { type: "rest_api"; key_hash: string }
  | ({ type: "obs_command"; key_hash: string } & EncryptedNodeKey);

/** Stores a node API key: always its SHA-256 hash (O(1) auth lookup), plus
 *  the AES-256-GCM encrypted form for obs_command keys only. */
export async function insertNodeApiKey(
  client: DBClient,
  nodeId: string,
  fields: NodeApiKeyFields,
): Promise<void> {
  const { error } = await client.from("obs_node_api_keys").insert({ node_id: nodeId, ...fields });
  if (error) throw error;
}

/** Returns the node_id for the given rest-api key hash, or null if not found.
 *  Used by obsNodeAuth middleware on every authenticated node request. Scoped to
 *  type='rest_api' so an obs_command key can never authenticate as a node. */
export async function lookupNodeByApiKeyHash(
  client: DBClient,
  keyHash: string,
): Promise<string | null> {
  const { data } = await client
    .from("obs_node_api_keys")
    .select("node_id")
    .eq("key_hash", keyHash)
    .eq("type", "rest_api")
    .maybeSingle();
  return data?.node_id ?? null;
}

/** The node's obs_command key hash, handed to the node via GET /api/obs-nodes/me
 *  so it can validate the switcher's Bearer without ever holding the plaintext. */
export async function getNodeCommandKeyHash(client: DBClient, nodeId: string): Promise<string | null> {
  const { data } = await client
    .from("obs_node_api_keys")
    .select("key_hash")
    .eq("node_id", nodeId)
    .eq("type", "obs_command")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.key_hash ?? null;
}

/** The node's obs_command key in encrypted form, read by the obs-auto-switcher
 *  (service role) and decrypted to the Bearer it sends to the node's /obs route. */
export async function getNodeCommandKeyEncrypted(client: DBClient, nodeId: string): Promise<EncryptedNodeKey | null> {
  const { data } = await client
    .from("obs_node_api_keys")
    .select("key_ciphertext, key_iv, key_tag")
    .eq("node_id", nodeId)
    .eq("type", "obs_command")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.key_ciphertext || !data.key_iv || !data.key_tag) return null;
  return { key_ciphertext: data.key_ciphertext, key_iv: data.key_iv, key_tag: data.key_tag };
}
