import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import {
  endIngestSession,
  getOutputKeysForKey,
  getStreamKeyOwner,
  insertIngestSession,
  touchStreamKey,
} from "@repo/supabase/queries/ingest";
import { TtlCache } from "@repo/ttl-cache";
import { endIngestSessionOnWsServer, postInternalBroadcast, registerIngestSessionOnWs } from "@/lib/ws-server";
import { endIngestSessionSchema, openIngestSessionSchema } from "@/schemas/ingest-nodes";
import { parseUuid } from "@/schemas/nodes-shared";

// An ingest node opens a session when a streamer connects and ends it when
// they leave. The node never names the user: it comes from the stream key on
// open and from the session row on end. A node can only end sessions it
// opened; another node's session gets the same 404 as a missing one.

/**
 * Stream-key lookups per node, against a node probing keys through this route
 * (the global brute-force guard only counts 401s per IP, and a bad key is a
 * 403). Each attempt is counted before the lookup, so parallel requests can't
 * slip past the limit, and given back when the key turns out valid, so normal
 * streaming never adds up. Every attempt, blocked ones too, restarts the
 * window: a node that keeps trying stays blocked. Per rest-api replica.
 */
const KEY_FAILURE_LIMIT = 30;
const keyFailures = new TtlCache<number>({ ttlMs: 10 * 60 * 1000, maxEntries: 10_000 });

/** Tests only. */
export function resetKeyFailures(): void {
  keyFailures.clear();
}

/**
 * POST /api/ingest-nodes/sessions
 *   { protocol, stream_key, remote_ip? }
 * → 201 { session_id, user_id, stream_key_id, label, output_keys }
 * → 403 for an unknown or inactive key (the node rejects the streamer)
 *
 * Latency matters: the media plane gives up after 5s.
 */
export async function openSession(c: Context) {
  const nodeId = c.get("ingestNodeId");
  const parsed = openIngestSessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body" }, 400);
  const { protocol, stream_key, remote_ip } = parsed.data;

  // Count the attempt before the lookup (synchronously, so concurrent
  // requests each see the ones before them).
  const attempts = (keyFailures.get(nodeId) ?? 0) + 1;
  keyFailures.set(nodeId, Math.min(attempts, KEY_FAILURE_LIMIT + 1));
  if (attempts > KEY_FAILURE_LIMIT) {
    return c.json({ error: "Too many invalid stream keys" }, 429);
  }

  const owner = await getStreamKeyOwner(supabase, stream_key, "cloud_obs");
  if (!owner) return c.json({ error: "Invalid stream key" }, 403);
  // A valid key gives its attempt back.
  keyFailures.set(nodeId, Math.max(0, (keyFailures.get(nodeId) ?? 1) - 1));

  void touchStreamKey(supabase, stream_key).catch(() => {});

  const [inserted, outputs] = await Promise.all([
    insertIngestSession(supabase, {
      user_id: owner.user_id,
      key_id: owner.key_id,
      protocol,
      remote_ip: remote_ip ?? null,
      node_id: nodeId,
    }),
    getOutputKeysForKey(supabase, owner.key_id),
  ]);
  if (inserted.error || !inserted.data) {
    return c.json({ error: "Could not open the session" }, 500);
  }
  const sessionId = inserted.data.id;
  if (outputs.error) {
    // Don't leave an open session behind for a stream the node will reject.
    await endIngestSession(supabase, sessionId, nodeId, null).catch(() => {});
    return c.json({ error: "Could not open the session" }, 500);
  }

  // Short timeout and never throws: ws-server looks a session up in the DB
  // when it hasn't heard of it.
  await registerIngestSessionOnWs({
    session_id: sessionId,
    user_id: owner.user_id,
    node_id: nodeId,
    stream_key_id: owner.key_id,
    label: owner.label,
  });

  return c.json(
    {
      session_id: sessionId,
      user_id: owner.user_id,
      stream_key_id: owner.key_id,
      label: owner.label,
      output_keys: (outputs.data ?? []).map((o) => o.output_key),
    },
    201,
  );
}

/**
 * POST /api/ingest-nodes/sessions/:id/end
 *   { last_bitrate_kbps }
 * → 200 { ok: true }, also when it had already ended
 * → 404 when no session with this id was opened by this node
 */
export async function endSession(c: Context<Env, "/sessions/:id/end">) {
  const nodeId = c.get("ingestNodeId");
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json({ error: "Session not found" }, 404);

  const parsed = endIngestSessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body" }, 400);
  const bitrate = parsed.data.last_bitrate_kbps;

  const ended = await endIngestSession(supabase, id, nodeId, bitrate === null ? null : Math.round(bitrate));
  if (!ended) return c.json({ error: "Session not found" }, 404);

  void endIngestSessionOnWsServer(id);
  if (ended.endedNow) {
    // The node used to send this itself. The auto-switcher drops the session
    // at once instead of waiting for its stats to time out.
    void postInternalBroadcast(ended.user_id, "streamwizard.ingest_session_ended", { session_id: id, node_id: nodeId });
  }
  return c.json({ ok: true });
}
