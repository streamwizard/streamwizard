import { z } from "zod";
import { claimToken, ipv4, mbCount, selfReportedIp } from "@/schemas/nodes-shared";

// Bodies an ingest node sends to /api/ingest-nodes/*. A node never names a
// user or its own node id: rest-api takes the node from its API key and the
// user from the stream key or the session row. Unlisted keys are stripped,
// not refused, so a node sending a field we don't take keeps working.

/** POST /claim: install.sh on a fresh VM, with only the claim token. */
export const claimIngestNodeSchema = z.object({
  token: claimToken,
  cpu_cores: z.number().int().min(0).max(4096).optional(),
  ram_total_mb: mbCount.optional(),
  storage_total_mb: mbCount.optional(),
  public_ip: selfReportedIp,
  lan_ip: selfReportedIp,
  tailscale_ip: selfReportedIp,
});

/** PATCH /me: the node reports its Tailscale IP once it has joined (`tailscale ip -4`). */
export const patchIngestNodeMeSchema = z.object({ tailscale_ip: ipv4 });

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
        session_id: z.uuid(),
        protocol,
        recorded_at: z.iso.datetime(),
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
