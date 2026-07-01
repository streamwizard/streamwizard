import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

type DBClient = SupabaseClient<Database>;

export type IngestProtocol = "rtmp" | "srt" | "srtla";

export interface StreamKeyOwner {
  user_id: string;
  key_id: string;
}

/**
 * Validate a stream key and return its owner. Used by the ingest control plane
 * on every connect. Mirrors getIrlCollectorTokenUserId in ./irl.ts.
 */
export async function getStreamKeyOwner(client: DBClient, streamKey: string): Promise<StreamKeyOwner | null> {
  const { data } = await client
    .from("ingest_stream_keys")
    .select("id, user_id")
    .eq("stream_key", streamKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  return { user_id: data.user_id, key_id: data.id };
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
}

/** Open a session row when a stream is authorized; returns the new session id. */
export const insertIngestSession = withMetrics(
  "ingest_sessions",
  "insert",
  async (client: DBClient, data: IngestSessionInsert) =>
    client.from("ingest_sessions").insert(data).select("id").single(),
);

/** Close a session row on disconnect. */
export const endIngestSession = withMetrics(
  "ingest_sessions",
  "update",
  async (client: DBClient, sessionId: string, lastBitrateKbps?: number | null) =>
    client
      .from("ingest_sessions")
      .update({ ended_at: new Date().toISOString(), last_bitrate_kbps: lastBitrateKbps ?? null })
      .eq("id", sessionId),
);

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
