import {
  ingestNodeMessageSchema,
  type IngestNodeMessage,
  type IngestNodeStats,
  type NodeBandwidthSample,
} from "@repo/schemas/ws-server";
import type { IngestNodeBandwidthPayload, IngestStatsPayload } from "@repo/types/overlay-ws";
import type { IngestSessionRegistry } from "./sessions";

// What an ingest node may send on its role=ingest-node socket, turned into
// what the rest of ws-server already understands. The node never names a
// user or its own node id: the node comes from the socket's token, and the
// user, stream key and label from the session registry.

export type ParsedIngestNodeMessage =
  | { ok: true; msg: IngestNodeMessage }
  | { ok: false; reason: "malformed_json" | "malformed_node_metrics" | "malformed_ingest_stats" };

/** One frame, parsed against the shared contract. The reason names the kind
 *  that was malformed, for the drop metric. */
export function parseIngestNodeMessage(raw: string): ParsedIngestNodeMessage {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed_json" };
  }
  const parsed = ingestNodeMessageSchema.safeParse(json);
  if (parsed.success) return { ok: true, msg: parsed.data };
  const kind = typeof json === "object" && json !== null ? (json as { kind?: unknown }).kind : undefined;
  if (kind === "node_metrics") return { ok: false, reason: "malformed_node_metrics" };
  if (kind === "ingest_stats") return { ok: false, reason: "malformed_ingest_stats" };
  return { ok: false, reason: "malformed_json" };
}

/** A parsed bandwidth sample with the node id from the token. */
export function nodeBandwidthFrom(nodeId: string, sample: NodeBandwidthSample): IngestNodeBandwidthPayload {
  return {
    ts: sample.ts ?? Date.now(),
    rx_bytes_per_sec: sample.rx_bytes_per_sec,
    tx_bytes_per_sec: sample.tx_bytes_per_sec,
    tailscale_rx_bytes_per_sec: sample.tailscale_rx_bytes_per_sec ?? 0,
    tailscale_tx_bytes_per_sec: sample.tailscale_tx_bytes_per_sec ?? 0,
    // Last, so nothing in the sample can name another node.
    node_id: nodeId,
  };
}

export type IngestStatsOutcome =
  | { ok: true; userId: string; payload: IngestStatsPayload }
  | { ok: false; reason: "unknown_session" | "foreign_session" | "ended_session" };

/**
 * Turns one parsed ingest_stats sample into the streamwizard.ingest_stats
 * payload ingest-control used to send, or says why it was dropped. A session
 * the node didn't open looks the same as a missing one to the node: dropped.
 */
export async function resolveIngestStats(
  registry: IngestSessionRegistry,
  nodeId: string,
  msg: Pick<IngestNodeStats, "session_id" | "protocol" | "stats">,
): Promise<IngestStatsOutcome> {
  const session = await registry.resolve(msg.session_id, nodeId);
  if (!session) return { ok: false, reason: "unknown_session" };
  // Ended first: an end with no registered session leaves a tombstone with no node.
  if (session.endedAt !== undefined) return { ok: false, reason: "ended_session" };
  if (session.nodeId !== nodeId) return { ok: false, reason: "foreign_session" };

  const payload: IngestStatsPayload = {
    ...msg.stats,
    // Identity last (the schema drops stats named like these).
    session_id: msg.session_id,
    protocol: msg.protocol,
    node_id: nodeId,
    stream_key_id: session.streamKeyId,
    ...(session.label !== null ? { label: session.label } : {}),
  };
  return { ok: true, userId: session.userId, payload };
}
