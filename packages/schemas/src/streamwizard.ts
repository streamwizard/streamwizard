import { z } from "zod";

export const OverlayGeoPayloadSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  accuracy: z.number(),
  timestamp: z.number(),
});

export const OverlayGeoEventSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("connected"), payload: OverlayGeoPayloadSchema }),
  z.object({ status: z.literal("offline"), payload: z.undefined() }),
]);

export const OverlayStatusPayloadSchema = z.object({
  status: z.literal("offline"),
});

/**
 * Pushed by the obs-instance-manager whenever a user's Cloud OBS container
 * transitions. "starting"/"stopping" are transitional (leading-edge, no DB
 * status) so other devices can show an honest "Starting…"/"Stopping…" during
 * the wait; the terminal "started"/"stopped"/"error" follows. "deleted" is an
 * action, not a DB status -- the row is removed on delete. The manager keeps a
 * matching local literal (it's a standalone repo that doesn't import this
 * package); keep the two in sync.
 */
export const ObsInstanceLifecyclePayloadSchema = z.object({
  instanceId: z.string(),
  action: z.enum(["starting", "started", "stopping", "stopped", "error", "deleted"]),
  /** ISO timestamp the manager observed the transition. */
  at: z.string(),
});

/**
 * Full raw + derived stat set broadcast by ingest-control's session-stats
 * handler. Everything below session identity is optional because RTMP only
 * reports throughput -- the SRT/SRTLA transport fields simply never appear.
 *
 * Deliberately `.loose()`: ingest-control ships independently and adds fields
 * ahead of this package, and this schema doubles as the validator for
 * hand-edited demo payloads. A strict object would reject a payload carrying a
 * field the real producer already emits.
 */
export const IngestStatsPayloadSchema = z
  .object({
    session_id: z.string(),
    protocol: z.enum(["rtmp", "srt", "srtla"]),
    /** Ingest node this session landed on (INGEST_NODE_ID). */
    node_id: z.string().optional(),
    /** Durable "camera" identity the session was authorized under. */
    stream_key_id: z.string().optional(),
    /** Human label of that stream key ("Camera 1"). */
    label: z.string().optional(),
    // Throughput
    kbps: z.number().optional(),
    mbps_recv_rate: z.number().optional(),
    mbps_bandwidth: z.number().optional(),
    mbps_max_bw: z.number().optional(),
    rtt_ms: z.number().optional(),
    // Window counters (since last sample)
    pkt_recv: z.number().optional(),
    pkt_recv_loss: z.number().optional(),
    pkt_recv_drop: z.number().optional(),
    pkt_recv_retrans: z.number().optional(),
    pkt_recv_belated: z.number().optional(),
    pkt_recv_undecrypt: z.number().optional(),
    pkt_reorder_distance: z.number().optional(),
    // Receiver buffer health
    ms_rcv_buf: z.number().optional(),
    byte_rcv_buf: z.number().optional(),
    pkt_flight_size: z.number().optional(),
    // Session totals
    pkt_recv_loss_total: z.number().optional(),
    pkt_recv_drop_total: z.number().optional(),
    pkt_recv_undecrypt_total: z.number().optional(),
    byte_recv_total: z.number().optional(),
    // Derived percentages (loss/drop/retrans over packets expected this window)
    loss_pct: z.number().optional(),
    drop_pct: z.number().optional(),
    retrans_pct: z.number().optional(),
  })
  .loose();

export type OverlayGeoPayload = z.infer<typeof OverlayGeoPayloadSchema>;
export type OverlayGeoEvent = z.infer<typeof OverlayGeoEventSchema>;
export type OverlayStatusPayload = z.infer<typeof OverlayStatusPayloadSchema>;
export type ObsInstanceLifecyclePayload = z.infer<typeof ObsInstanceLifecyclePayloadSchema>;
export type IngestStatsPayload = z.infer<typeof IngestStatsPayloadSchema>;
