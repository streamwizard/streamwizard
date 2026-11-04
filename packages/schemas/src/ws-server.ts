import { z } from "zod";
import { IngestStatsPayloadSchema } from "./streamwizard";

// What ws-server receives, and what its consumers receive from it. Each side
// of these contracts parses with the schema here: ws-server for bot and
// ingest-node frames and its /internal/* bodies, obs-auto-switcher for the
// consumer feed. The senders build them from the types in @repo/types and
// @repo/ws-client (ingest-server keeps its own copy of the ingest-node types).
//
// Objects strip unknown keys on purpose: senders ship on their own schedule
// and may send fields we don't read (older ingest nodes put node_id in
// node_metrics, the config push carries the whole config row).

/** The user whose room a message is for. */
const roomUserId = z.string().min(1).max(128);

/** An event type name ("channel.follow", "streamwizard.ingest_stats"). */
const eventType = z.string().min(1).max(128);

/** Bytes per second. A counter reset on a node can make one sample negative;
 *  ws-server clamps those to 0 instead of dropping the sample. */
const byteRate = z.number().min(-1e12).max(1e12);

/** Epoch milliseconds. */
const epochMs = z.number().min(0).max(1e14);

// ── role=bot and POST /internal/broadcast ──────────────────────────────────

/**
 * A fan-out message for one user's room. `payload` is passed through as-is:
 * it is an EventSub event or one of our own payloads, and each receiver
 * parses the payloads it uses.
 */
export const botBroadcastMessageSchema = z.object({
  userId: roomUserId,
  type: eventType,
  payload: z.unknown(),
});
export type BotBroadcast = z.infer<typeof botBroadcastMessageSchema>;

/** Heartbeat. ws-server echoes `ts` back in a pong. */
export const botPingMessageSchema = z.object({
  kind: z.literal("ping"),
  ts: z.number(),
});

/** One NIC throughput sample from an ingest node. ws-server fills in a missing
 *  `ts` (now) and missing Tailscale rates (0). */
export const nodeBandwidthSampleSchema = z.object({
  ts: epochMs.optional(),
  rx_bytes_per_sec: byteRate,
  tx_bytes_per_sec: byteRate,
  tailscale_rx_bytes_per_sec: byteRate.optional(),
  tailscale_tx_bytes_per_sec: byteRate.optional(),
});
export type NodeBandwidthSample = z.infer<typeof nodeBandwidthSampleSchema>;

/** node_metrics on a bot socket: older ingest nodes that name themselves. */
export const botNodeMetricsMessageSchema = z.object({
  kind: z.literal("node_metrics"),
  payload: nodeBandwidthSampleSchema.extend({ node_id: z.string().min(1).max(64) }),
});

/** The node-scoped frames a bot socket may send (they carry `kind`; fan-out
 *  broadcasts don't). */
export const botNodeScopedMessageSchema = z.discriminatedUnion("kind", [
  botPingMessageSchema,
  botNodeMetricsMessageSchema,
]);

// ── role=ingest-node ───────────────────────────────────────────────────────

const MAX_STAT_KEYS = 64;
const MAX_STAT_KEY_LENGTH = 64;
/** Payload fields ws-server sets itself; a stat with one of these names is dropped. */
const IDENTITY_KEYS = new Set(["session_id", "protocol", "node_id", "stream_key_id", "label"]);

/**
 * A sample's stats: numeric, finite values only, at most MAX_STAT_KEYS of
 * them, and none named like an identity field. Entries that don't fit are
 * dropped, not refused: a node adding a counter must not lose the sample.
 */
export const ingestStatValuesSchema = z.record(z.string(), z.unknown()).transform((stats) => {
  const out: Record<string, number> = {};
  let count = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value !== "number" || !Number.isFinite(value) || key.length > MAX_STAT_KEY_LENGTH) continue;
    if (IDENTITY_KEYS.has(key)) continue;
    out[key] = value;
    if (++count >= MAX_STAT_KEYS) break;
  }
  return out;
});

/** One live quality sample. The node never names a user or its own id: ws-server
 *  takes the node from the socket's token and the rest from the session. */
export const ingestNodeStatsMessageSchema = z.object({
  kind: z.literal("ingest_stats"),
  session_id: z.uuid(),
  protocol: IngestStatsPayloadSchema.shape.protocol,
  stats: ingestStatValuesSchema,
  /** ISO time the node received the sample. Not used by ws-server. */
  at: z.string().max(64).optional(),
});
export type IngestNodeStats = z.infer<typeof ingestNodeStatsMessageSchema>;

/** The node's NIC throughput. A node_id in the payload is dropped: the node
 *  comes from the socket's token. */
export const ingestNodeMetricsMessageSchema = z.object({
  kind: z.literal("node_metrics"),
  payload: nodeBandwidthSampleSchema,
});

export const ingestNodeMessageSchema = z.discriminatedUnion("kind", [
  botPingMessageSchema,
  ingestNodeMetricsMessageSchema,
  ingestNodeStatsMessageSchema,
]);
export type IngestNodeMessage = z.infer<typeof ingestNodeMessageSchema>;

// ── /internal/* bodies ─────────────────────────────────────────────────────

/** POST /internal/revoke */
export const revokeRequestSchema = z.object({
  userId: roomUserId,
  scope: z.enum(["scene", "session", "all"]),
});
export type RevokeRequest = z.infer<typeof revokeRequestSchema>;

/** POST /internal/ingest-sessions: a session rest-api just opened for a node. */
export const ingestSessionRegistrationSchema = z.object({
  session_id: z.uuid(),
  user_id: z.uuid(),
  node_id: z.uuid(),
  stream_key_id: z.uuid(),
  label: z.string().max(1024).nullish(),
});
export type IngestSessionRegistration = z.infer<typeof ingestSessionRegistrationSchema>;

// ── role=consumer (ws-server → obs-auto-switcher) ──────────────────────────

/** Every frame ws-server sends a consumer. */
export const consumerMessageSchema = z.object({
  userId: roomUserId,
  type: eventType,
  payload: z.unknown(),
  ts: z.number().optional(),
});

/** streamwizard.ingest_session_ended, sent by rest-api when a node ends a session. */
export const ingestSessionEndedPayloadSchema = z.object({
  session_id: z.uuid(),
  node_id: z.uuid().optional(),
});
export type IngestSessionEndedPayload = z.infer<typeof ingestSessionEndedPayloadSchema>;
