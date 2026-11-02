import type { IngestNodeBandwidthPayload, IngestNodeOutboundMessage, IngestStatsPayload } from "@repo/types";
import type { IngestSessionRegistry } from "./ingest-sessions";

// What an ingest node may send on its role=ingest-node socket, turned into
// what the rest of ws-server already understands. The node never names a
// user or its own node id: the node comes from the socket's token, and the
// user, stream key and label from the session registry.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROTOCOLS = new Set(["rtmp", "srt", "srtla"]);
const MAX_STAT_KEYS = 64;
const MAX_STAT_KEY_LENGTH = 64;
/** Payload fields ws-server sets itself; a stat with one of these names is dropped. */
const IDENTITY_KEYS = new Set(["session_id", "protocol", "node_id", "stream_key_id", "label"]);

/** Numeric, finite values only, at most MAX_STAT_KEYS of them, and none named
 *  like an identity field. */
export function boundStats(stats: unknown): Record<string, number> | null {
  if (typeof stats !== "object" || stats === null || Array.isArray(stats)) return null;
  const out: Record<string, number> = {};
  let count = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value !== "number" || !Number.isFinite(value) || key.length > MAX_STAT_KEY_LENGTH) continue;
    if (IDENTITY_KEYS.has(key)) continue;
    out[key] = value;
    if (++count >= MAX_STAT_KEYS) break;
  }
  return out;
}

export function parseIngestNodeMessage(raw: string): IngestNodeOutboundMessage | null {
  try {
    const msg = JSON.parse(raw) as unknown;
    return typeof msg === "object" && msg !== null && "kind" in msg ? (msg as IngestNodeOutboundMessage) : null;
  } catch {
    return null;
  }
}

/** node_metrics with the node id from the token; null when malformed. */
export function nodeBandwidthFrom(nodeId: string, payload: unknown): IngestNodeBandwidthPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const num = (k: string) => (typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : null);
  const rx = num("rx_bytes_per_sec");
  const tx = num("tx_bytes_per_sec");
  if (rx === null || tx === null) return null;
  return {
    ts: num("ts") ?? Date.now(),
    rx_bytes_per_sec: rx,
    tx_bytes_per_sec: tx,
    tailscale_rx_bytes_per_sec: num("tailscale_rx_bytes_per_sec") ?? 0,
    tailscale_tx_bytes_per_sec: num("tailscale_tx_bytes_per_sec") ?? 0,
    // Last, so nothing in the payload can name another node.
    node_id: nodeId,
  };
}

export type IngestStatsOutcome =
  | { ok: true; userId: string; payload: IngestStatsPayload }
  | { ok: false; reason: "malformed_ingest_stats" | "unknown_session" | "foreign_session" | "ended_session" };

/**
 * Turns one ingest_stats sample into the streamwizard.ingest_stats payload
 * ingest-control used to send, or says why it was dropped. A session the
 * node didn't open looks the same as a missing one to the node: dropped.
 */
export async function resolveIngestStats(
  registry: IngestSessionRegistry,
  nodeId: string,
  msg: { session_id?: unknown; protocol?: unknown; stats?: unknown },
): Promise<IngestStatsOutcome> {
  const sessionId = msg.session_id;
  const protocol = msg.protocol;
  const stats = boundStats(msg.stats);
  if (typeof sessionId !== "string" || !UUID.test(sessionId) || typeof protocol !== "string" || !PROTOCOLS.has(protocol) || !stats) {
    return { ok: false, reason: "malformed_ingest_stats" };
  }

  const session = await registry.resolve(sessionId, nodeId);
  if (!session) return { ok: false, reason: "unknown_session" };
  // Ended first: an end with no registered session leaves a tombstone with no node.
  if (session.endedAt !== undefined) return { ok: false, reason: "ended_session" };
  if (session.nodeId !== nodeId) return { ok: false, reason: "foreign_session" };

  return {
    ok: true,
    userId: session.userId,
    payload: {
      ...stats,
      // Identity last (and boundStats drops stats named like these).
      session_id: sessionId,
      protocol: protocol as IngestStatsPayload["protocol"],
      node_id: nodeId,
      stream_key_id: session.streamKeyId,
      ...(session.label !== null ? { label: session.label } : {}),
    } as IngestStatsPayload,
  };
}
