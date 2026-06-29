import { type Context } from "hono";
import { z } from "zod";
import { supabase } from "@repo/supabase";
import { insertIngestSessionStatsBatch, type IngestSessionStatsInsert } from "@repo/supabase/queries/ingest";
import { wsBroadcastClient } from "../lib/ws-broadcast";

const bodySchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  protocol: z.enum(["rtmp", "srt", "srtla"]),
  stats: z.object({
    kbps: z.number().optional(),
    mbps_recv_rate: z.number().optional(),
    mbps_bandwidth: z.number().optional(),
    rtt_ms: z.number().optional(),
    pkt_recv_loss: z.number().optional(),
    pkt_recv_drop: z.number().optional(),
    pkt_recv_retrans: z.number().optional(),
    pkt_recv_loss_total: z.number().optional(),
    byte_recv_total: z.number().optional(),
  }),
});

export interface SessionStatsEntry {
  user_id: string;
  protocol: string;
  stats: Record<string, number>;
  updated_at: string;
}

// "Current" snapshot per active session, for instant reads (e.g. a future
// scene-switcher polling "how is this stream doing right now"). Bounded by the
// number of concurrently active sessions — overwritten in place, never
// accumulates — and entries are removed at session-end.
const latestStats = new Map<string, SessionStatsEntry>();

// Durable history is batched, not written per-sample: every report lands here
// first, and a timer below bulk-inserts + clears this on a fixed interval.
// Deliberately dropped (not retried) on insert failure — a metrics pipeline
// that retries forever on a network blip is how this buffer becomes the next
// "store it in RAM" problem.
let pendingRows: IngestSessionStatsInsert[] = [];

const FLUSH_INTERVAL_MS = 30_000;

async function flushPendingStats(): Promise<void> {
  if (pendingRows.length === 0) return;
  const batch = pendingRows;
  pendingRows = [];
  const { error } = await insertIngestSessionStatsBatch(supabase, batch);
  if (error) {
    console.error(`[session-stats] failed to insert batch of ${batch.length}:`, error);
  }
}

export function startSessionStatsFlusher(): void {
  setInterval(() => {
    flushPendingStats().catch((err) => console.error("[session-stats] flush error:", err));
  }, FLUSH_INTERVAL_MS);
}

export function clearSessionStats(sessionId: string): void {
  latestStats.delete(sessionId);
}

/**
 * POST /internal/session-stats
 *
 * Called by the media plane every couple of seconds while a session is active,
 * reporting throughput (and, for SRT/SRTLA, loss/RTT/bandwidth) for that stream.
 */
export async function sessionStatsHandler(c: Context) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const updatedAt = new Date().toISOString();

  latestStats.set(body.session_id, {
    user_id: body.user_id,
    protocol: body.protocol,
    stats: body.stats,
    updated_at: updatedAt,
  });

  pendingRows.push({
    session_id: body.session_id,
    user_id: body.user_id,
    protocol: body.protocol,
    recorded_at: updatedAt,
    ...body.stats,
  });

  wsBroadcastClient.send({
    userId: body.user_id,
    type: "streamwizard.ingest_stats",
    payload: { session_id: body.session_id, protocol: body.protocol, ...body.stats },
  });

  return c.json({ ok: true });
}

/**
 * GET /internal/session-stats/:sessionId
 *
 * Latest known quality snapshot for an active session — served from memory,
 * not the database, so it reflects the most recent sample even before the
 * next batch flush.
 */
export async function getSessionStatsHandler(c: Context) {
  const sessionId = c.req.param("sessionId");
  const entry = sessionId ? latestStats.get(sessionId) : undefined;
  if (!entry) {
    return c.json({ error: "No stats for session" }, 404);
  }
  return c.json(entry);
}
