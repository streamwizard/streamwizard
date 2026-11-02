import { z } from "zod";

// Bodies an ingest node sends to /api/ingest-nodes/*. A node never names a
// user or its own node id: rest-api takes the node from its API key and the
// user from the stream key or the session row.

const protocol = z.enum(["rtmp", "srt", "srtla"]);

/** POST /sessions: authorize a stream key and open a session. */
export const openIngestSessionSchema = z.object({
  protocol,
  stream_key: z.string().min(1).max(256),
  remote_ip: z.string().max(64).nullable().optional(),
});

/** POST /sessions/:id/end */
export const endIngestSessionSchema = z.object({
  last_bitrate_kbps: z.number().finite().nonnegative().nullable(),
});

const stat = z.number().finite().nullable().optional();

/** POST /session-stats: the node's 30-second batch of quality samples. */
export const ingestSessionStatsSchema = z.object({
  rows: z
    .array(
      z.object({
        session_id: z.string().uuid(),
        protocol,
        recorded_at: z.string().datetime(),
        kbps: stat,
        mbps_recv_rate: stat,
        mbps_bandwidth: stat,
        rtt_ms: stat,
        pkt_recv_loss: stat,
        pkt_recv_drop: stat,
        pkt_recv_retrans: stat,
        pkt_recv_loss_total: stat,
        byte_recv_total: stat,
      }),
    )
    .max(5000),
});
