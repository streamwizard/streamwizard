import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { getUserActiveSubscriptionId } from "./subscriptions";
import { withMetrics } from "./with-metrics";

type DBClient = SupabaseClient<Database>;

export type IngestProtocol = "rtmp" | "srt" | "srtla";

export interface StreamKeyOwner {
  user_id: string;
  key_id: string;
  /** Human label of the key ("Camera 1"). */
  label: string;
}

/**
 * Validate a stream key and return its owner. Used by the ingest control plane
 * on every connect. Mirrors getIrlCollectorTokenUserId in ./irl.ts.
 *
 * The key must be active and its owner must hold a plan for `productId` that
 * may start things (getUserActiveSubscriptionId: active or trialing, period
 * not over). Null otherwise, the same answer as for an unknown key.
 */
export async function getStreamKeyOwner(
  client: DBClient,
  streamKey: string,
  productId: string,
): Promise<StreamKeyOwner | null> {
  const { data } = await client
    .from("ingest_stream_keys")
    .select("id, user_id, label")
    .eq("stream_key", streamKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  if (!(await getUserActiveSubscriptionId(client, data.user_id, productId))) return null;
  return { user_id: data.user_id, key_id: data.id, label: data.label };
}

/**
 * Turns all of a user's ingest keys on or off (keys are never deleted here).
 * Only rows that change are written; returns their ids. Throws on error.
 */
export async function setIngestKeysActiveForUser(client: DBClient, userId: string, active: boolean): Promise<string[]> {
  const { data, error } = await client
    .from("ingest_stream_keys")
    .update({ is_active: active })
    .eq("user_id", userId)
    .eq("is_active", !active)
    .select("id");
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function touchStreamKey(client: DBClient, streamKey: string): Promise<void> {
  await client
    .from("ingest_stream_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("stream_key", streamKey);
}

export interface IngestSessionInsert {
  user_id: string;
  key_id: string;
  protocol: IngestProtocol;
  remote_ip?: string | null;
  /** The ingest node that opened it (rest-api takes it from the node's key). */
  node_id: string;
}

/** Open a session row when a stream is authorized; returns the new session id. */
export const insertIngestSession = withMetrics(
  "ingest_sessions",
  "insert",
  async (client: DBClient, data: IngestSessionInsert) =>
    client.from("ingest_sessions").insert(data).select("id").single(),
);

/** OBS output keys an authorized ingest key pushes to (active ones only). */
export const getOutputKeysForKey = withMetrics(
  "ingest_output_keys",
  "select",
  async (client: DBClient, keyId: string) =>
    client.from("ingest_output_keys").select("output_key").eq("key_id", keyId).eq("is_active", true),
);

const closeOpenSessionForNode = withMetrics(
  "ingest_sessions",
  "update",
  async (client: DBClient, sessionId: string, nodeId: string, lastBitrateKbps: number | null) =>
    client
      .from("ingest_sessions")
      .update({ ended_at: new Date().toISOString(), last_bitrate_kbps: lastBitrateKbps })
      .eq("id", sessionId)
      .eq("node_id", nodeId)
      .is("ended_at", null)
      .select("user_id"),
);

const selectSessionOwnerForNode = withMetrics(
  "ingest_sessions",
  "select",
  async (client: DBClient, sessionId: string, nodeId: string) =>
    client.from("ingest_sessions").select("user_id").eq("id", sessionId).eq("node_id", nodeId).maybeSingle(),
);

/**
 * Ends one of the node's sessions. The first call sets ended_at and the last
 * bitrate; later calls change nothing (endedNow: false). null when no session
 * with this id was opened by this node, the same as a missing one.
 */
export async function endIngestSession(
  client: DBClient,
  sessionId: string,
  nodeId: string,
  lastBitrateKbps: number | null,
): Promise<{ user_id: string; endedNow: boolean } | null> {
  const closed = await closeOpenSessionForNode(client, sessionId, nodeId, lastBitrateKbps);
  if (closed.error) throw closed.error;
  if (closed.data?.[0]) return { user_id: closed.data[0].user_id, endedNow: true };

  const existing = await selectSessionOwnerForNode(client, sessionId, nodeId);
  if (existing.error) throw existing.error;
  return existing.data ? { user_id: existing.data.user_id, endedNow: false } : null;
}

/** Owners of the node's own sessions among `sessionIds`. Ids that are unknown
 *  or belong to another node are simply absent from the map. */
export async function getIngestSessionOwnersForNode(
  client: DBClient,
  sessionIds: string[],
  nodeId: string,
): Promise<Map<string, string>> {
  if (sessionIds.length === 0) return new Map();
  const { data, error } = await client
    .from("ingest_sessions")
    .select("id, user_id")
    .in("id", sessionIds)
    .eq("node_id", nodeId);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.id, r.user_id]));
}

export interface IngestSessionRoute {
  user_id: string;
  node_id: string | null;
  key_id: string;
  label: string | null;
  ended_at: string | null;
}

/** What ws-server needs to route a live sample when its in-memory session
 *  registry has no entry (after a restart, or on another replica). */
export async function getIngestSessionRoute(client: DBClient, sessionId: string): Promise<IngestSessionRoute | null> {
  const { data, error } = await client
    .from("ingest_sessions")
    .select("user_id, node_id, key_id, ended_at, ingest_stream_keys(label)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const key = Array.isArray(data.ingest_stream_keys) ? data.ingest_stream_keys[0] : data.ingest_stream_keys;
  return {
    user_id: data.user_id,
    node_id: data.node_id,
    key_id: data.key_id,
    label: key?.label ?? null,
    ended_at: data.ended_at,
  };
}

export interface IngestSessionStatsInsert {
  session_id: string;
  user_id: string;
  protocol: IngestProtocol;
  recorded_at: string;
  kbps?: number | null;
  mbps_recv_rate?: number | null;
  mbps_bandwidth?: number | null;
  rtt_ms?: number | null;
  pkt_recv_loss?: number | null;
  pkt_recv_drop?: number | null;
  pkt_recv_retrans?: number | null;
  pkt_recv_loss_total?: number | null;
  byte_recv_total?: number | null;
}

/** Bulk-insert a batch of buffered quality samples in one round trip. */
export const insertIngestSessionStatsBatch = withMetrics(
  "ingest_session_stats",
  "insert",
  async (client: DBClient, rows: IngestSessionStatsInsert[]) => client.from("ingest_session_stats").insert(rows),
);

// ── Streamer-facing key management ───────────────────────────────────────────
// Ingest keys (what a phone/encoder publishes to) and their OBS output keys
// (what OBS pulls). Both are service-role only: the tables hold live secrets,
// so the web app reaches them through admin-client actions, never RLS.

export const selectIngestKeyForUser = withMetrics(
  "ingest_stream_keys",
  "select",
  async (client: DBClient, id: string, userId: string) =>
    client.from("ingest_stream_keys").select("label, stream_key").eq("id", id).eq("user_id", userId).maybeSingle(),
);

export const selectIngestKeyIds = withMetrics(
  "ingest_stream_keys",
  "select",
  async (client: DBClient, userId: string) =>
    client.from("ingest_stream_keys").select("id").eq("user_id", userId).limit(1),
);

export const selectIngestKeys = withMetrics(
  "ingest_stream_keys",
  "select",
  async (client: DBClient, userId: string) =>
    client.from("ingest_stream_keys").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
);

export const insertIngestKey = withMetrics(
  "ingest_stream_keys",
  "insert",
  async (client: DBClient, values: { user_id: string; stream_key: string; label: string }) =>
    client.from("ingest_stream_keys").insert(values).select("*").single(),
);

export const rotateIngestKeySecret = withMetrics(
  "ingest_stream_keys",
  "update",
  async (client: DBClient, id: string, userId: string, streamKey: string) =>
    client
      .from("ingest_stream_keys")
      .update({ stream_key: streamKey })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single(),
);

export const deleteIngestKey = withMetrics(
  "ingest_stream_keys",
  "delete",
  async (client: DBClient, id: string, userId: string) =>
    client.from("ingest_stream_keys").delete().eq("id", id).eq("user_id", userId),
);

/** Ownership check before an output key is attached to an ingest key. */
export const ingestKeyBelongsToUser = async (client: DBClient, keyId: string, userId: string) => {
  const { data } = await client
    .from("ingest_stream_keys")
    .select("id")
    .eq("id", keyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
};

export const insertOutputKey = withMetrics(
  "ingest_output_keys",
  "insert",
  async (client: DBClient, values: { user_id: string; key_id: string; output_key: string; label: string }) =>
    client.from("ingest_output_keys").insert(values).select("*").single(),
);

export const selectOutputKeys = withMetrics(
  "ingest_output_keys",
  "select",
  async (client: DBClient, userId: string, keyId?: string) => {
    const query = client.from("ingest_output_keys").select("*").eq("user_id", userId);
    return (keyId ? query.eq("key_id", keyId) : query).order("created_at", { ascending: false });
  },
);

export const rotateOutputKeySecret = withMetrics(
  "ingest_output_keys",
  "update",
  async (client: DBClient, id: string, userId: string, outputKey: string) =>
    client
      .from("ingest_output_keys")
      .update({ output_key: outputKey })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single(),
);

export const deleteOutputKey = withMetrics(
  "ingest_output_keys",
  "delete",
  async (client: DBClient, id: string, userId: string) =>
    client.from("ingest_output_keys").delete().eq("id", id).eq("user_id", userId),
);
