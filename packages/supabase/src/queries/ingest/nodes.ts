import type { SupabaseClient } from "@supabase/supabase-js";
import { reportError } from "@repo/sentry";
import type { Database } from "../../types/supabase";

type DBClient = SupabaseClient<Database>;

type IngestNodeRow = Database["public"]["Tables"]["ingest_nodes"]["Row"];
type IngestNodeSecretColumn =
  | "claim_token_hash"
  | "control_secret_ciphertext"
  | "control_secret_iv"
  | "control_secret_tag";

/** An ingest node as admin pages and the node itself see it: no claim hash, no control-secret columns. */
export type IngestNode = Omit<IngestNodeRow, IngestNodeSecretColumn>;

/**
 * Every ingest_nodes column except the claim-token hash and the encrypted
 * control secret. Every read and every write's returned row uses this list
 * instead of "*", so a new secret column stays out until it's added here.
 */
export const INGEST_NODE_COLUMNS =
  "id, name, status, maintenance, hostname, public_hostname, public_ip, lan_ip, tailscale_ip, cpu_cores, ram_total_mb, storage_total_mb, max_concurrent_sessions, claim_token_expires_at, created_at, updated_at" as const;

/** What the fleet overview needs: identity, status and the tailnet address it probes. */
export const INGEST_NODE_REGISTRY_COLUMNS = "id, name, status, maintenance, created_at, tailscale_ip" as const;

export type IngestNodeRegistryRow = Pick<IngestNodeRow, "id" | "name" | "status" | "maintenance" | "created_at" | "tailscale_ip">;

export interface IngestNodeCapacity {
  name: string;
  max_concurrent_sessions: number | null;
  /** Admin-set public FQDN encoders connect to (e.g. ingest-01.streamwizard.org).
   * null when ops hasn't pointed a domain at this box yet. */
  public_hostname: string | null;
}

export interface IngestNodeClaimFields {
  claim_token_hash: string;
  claim_token_expires_at: string;
}

export async function listIngestNodes(client: DBClient): Promise<{ data: IngestNode[] | null; error: string | null }> {
  const { data, error } = await client
    .from("ingest_nodes")
    .select(INGEST_NODE_COLUMNS)
    .order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

/** The registry rows the fleet overview probes; polled by the admin metrics pages. */
export async function listIngestNodeRegistryRows(
  client: DBClient,
): Promise<{ data: IngestNodeRegistryRow[] | null; error: string | null }> {
  const { data, error } = await client
    .from("ingest_nodes")
    .select(INGEST_NODE_REGISTRY_COLUMNS)
    .order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getIngestNodeById(client: DBClient, id: string): Promise<IngestNode | null> {
  const { data } = await client.from("ingest_nodes").select(INGEST_NODE_COLUMNS).eq("id", id).maybeSingle();
  return data;
}

export interface IngestNodeHosts {
  /** Admin-set public FQDN encoders connect to, preferred over public_ip when set. */
  public_hostname: string | null;
  /** Public IP encoders push their SRT/SRTLA feed to (fallback when no domain is set). */
  public_ip: string | null;
  /** Tailnet IP a cloud OBS instance pulls the feed from. */
  tailscale_ip: string | null;
}

/** The node users' ingest keys resolve to. v1 runs a single ingest node, so
 * this returns the most recently linked one; when multi-node lands this is the
 * seam to replace with a per-user assignment lookup. */
export async function getActiveIngestNodeHosts(client: DBClient): Promise<IngestNodeHosts | null> {
  const { data } = await client
    .from("ingest_nodes")
    .select("public_hostname, public_ip, tailscale_ip")
    .eq("status", "linked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Postgres unique_violation. ingest_nodes.name has a UNIQUE constraint
// (ingest_nodes_name_key) since the name doubles as the node's hostname --
// two nodes sharing one would mean two machines claiming the same hostname.
// Translate the raw constraint-violation message into something an admin
// can act on, rather than surfacing Postgres's internal wording.
function describeIngestNodeError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") return "A node with this name already exists. Names must be unique.";
  reportError(error, "ingest-nodes.save");
  return "Couldn't save the node. Try again?";
}

export async function createIngestNode(
  client: DBClient,
  fields: IngestNodeCapacity & IngestNodeClaimFields,
): Promise<{ data: IngestNode | null; error: string | null }> {
  const { data, error } = await client
    .from("ingest_nodes")
    .insert({ ...fields, status: "pending" })
    .select(INGEST_NODE_COLUMNS)
    .single();
  return { data, error: describeIngestNodeError(error) };
}

export async function updateIngestNodeCapacity(
  client: DBClient,
  id: string,
  fields: IngestNodeCapacity,
): Promise<{ data: IngestNode | null; error: string | null }> {
  const { data, error } = await client.from("ingest_nodes").update(fields).eq("id", id).select(INGEST_NODE_COLUMNS).single();
  return { data, error: describeIngestNodeError(error) };
}

export async function deleteIngestNode(client: DBClient, id: string): Promise<{ error: string | null }> {
  const { error } = await client.from("ingest_nodes").delete().eq("id", id);
  if (!error) return { error: null };
  // foreign_key_violation: something still points at the node.
  if (error.code === "23503") return { error: "This node still has instances or sessions. Remove those first." };
  reportError(error, "ingest-nodes.delete");
  return { error: "Couldn't delete the node. Try again?" };
}

/** Looks up by hash regardless of status, so an already-linked row from a
 * near-simultaneous replay is still found (lets the claim endpoint return 409
 * instead of a misleading 404). */
export async function claimIngestNodeByTokenHash(client: DBClient, tokenHash: string): Promise<IngestNode | null> {
  const { data } = await client.from("ingest_nodes").select(INGEST_NODE_COLUMNS).eq("claim_token_hash", tokenHash).maybeSingle();
  return data;
}

export interface IngestNodeSelfReportedFields {
  cpu_cores?: number;
  ram_total_mb?: number;
  storage_total_mb?: number;
  public_ip?: string | null;
  lan_ip?: string | null;
  tailscale_ip?: string | null;
  hostname: string;
  control_secret_ciphertext: string;
  control_secret_iv: string;
  control_secret_tag: string;
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
// Twin of consumeClaimToken in obs-nodes/nodes.ts on purpose: the two node
// tables have their own columns, and a shared helper needs a generic over both.
export async function consumeIngestClaimToken(
  client: DBClient,
  tokenHash: string,
  fields: IngestNodeSelfReportedFields,
): Promise<IngestNode | null> {
  const { data } = await client
    .from("ingest_nodes")
    .update({
      status: "linked",
      claim_token_hash: null,
      claim_token_expires_at: null,
      ...fields,
    })
    .eq("claim_token_hash", tokenHash)
    .neq("status", "linked")
    .gt("claim_token_expires_at", new Date().toISOString())
    .select(INGEST_NODE_COLUMNS)
    .maybeSingle();
  return data;
}

// ── Node API keys ────────────────────────────────────────────────────────────

export interface IngestNodeApiKeyFields {
  key_hash: string;
}

/** Stores the SHA-256 hash of an ingest node's API key, the only thing
 *  ingestNodeAuth needs. No encrypted copy, so TOKEN_ENCRYPTION_KEY can't
 *  rebuild it. */
export async function insertIngestNodeApiKey(
  client: DBClient,
  nodeId: string,
  fields: IngestNodeApiKeyFields,
): Promise<void> {
  const { error } = await client.from("ingest_node_api_keys").insert({ node_id: nodeId, ...fields });
  if (error) throw error;
}

/** Returns the node_id for the given key hash, or null if not found.
 *  For a future ingestNodeAuth middleware, unused today. */
export async function lookupIngestNodeByApiKeyHash(
  client: DBClient,
  keyHash: string,
): Promise<string | null> {
  const { data } = await client
    .from("ingest_node_api_keys")
    .select("node_id")
    .eq("key_hash", keyHash)
    .maybeSingle();
  return data?.node_id ?? null;
}

/** Self-reported by the node itself once it actually has a Tailscale IP --
 *  at /claim time (deferred-join case) the node hasn't joined the tailnet
 *  yet, since the auth key it needs to join comes back IN the claim
 *  response, so tailscale_ip is unknown until after that response lands. */
export async function updateIngestNodeTailscaleIp(
  client: DBClient,
  id: string,
  tailscaleIp: string,
): Promise<{ data: IngestNode | null; error: string | null }> {
  const { data, error } = await client
    .from("ingest_nodes")
    .update({ tailscale_ip: tailscaleIp })
    .eq("id", id)
    .select(INGEST_NODE_COLUMNS)
    .single();
  return { data, error: error?.message ?? null };
}
