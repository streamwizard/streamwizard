import { supabase } from "@repo/supabase";
import {
  endIngestSession,
  getOutputKeysForKey,
  getStreamKeyOwner,
  insertIngestSession,
  touchStreamKey,
} from "@repo/supabase/queries/ingest/ingest";
import { TtlCache } from "@repo/ttl-cache";
import { endIngestSessionOnWsServer, postInternalBroadcast, registerIngestSessionOnWs } from "@/lib/ws-server";
import type { OpenIngestSessionInput } from "@/modules/ingest-nodes/schemas";

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

export interface OpenedSession {
  session_id: string;
  user_id: string;
  stream_key_id: string;
  label: string | null;
  output_keys: string[];
}

/**
 * POST /api/ingest-nodes/sessions: authorizes a stream key and opens a
 * session on the calling node. "invalid_key" for an unknown or inactive key
 * (the node rejects the streamer).
 *
 * Latency matters: the media plane gives up after 5s.
 */
export async function openSession(
  nodeId: string,
  input: OpenIngestSessionInput,
): Promise<{ ok: true; session: OpenedSession } | { ok: false; reason: "rate_limited" | "invalid_key" | "failed" }> {
  const { protocol, stream_key, remote_ip } = input;

  // Count the attempt before the lookup (synchronously, so concurrent
  // requests each see the ones before them).
  const attempts = (keyFailures.get(nodeId) ?? 0) + 1;
  keyFailures.set(nodeId, Math.min(attempts, KEY_FAILURE_LIMIT + 1));
  if (attempts > KEY_FAILURE_LIMIT) {
    return { ok: false, reason: "rate_limited" };
  }

  const owner = await getStreamKeyOwner(supabase, stream_key, "cloud_obs");
  if (!owner) return { ok: false, reason: "invalid_key" };
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
    return { ok: false, reason: "failed" };
  }
  const sessionId = inserted.data.id;
  if (outputs.error) {
    // Don't leave an open session behind for a stream the node will reject.
    await endIngestSession(supabase, sessionId, nodeId, null).catch(() => {});
    return { ok: false, reason: "failed" };
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

  return {
    ok: true,
    session: {
      session_id: sessionId,
      user_id: owner.user_id,
      stream_key_id: owner.key_id,
      label: owner.label,
      output_keys: (outputs.data ?? []).map((o) => o.output_key),
    },
  };
}

/**
 * POST /api/ingest-nodes/sessions/:id/end
 * → true, also when it had already ended
 * → false when no session with this id was opened by this node
 */
export async function endSession(nodeId: string, id: string, bitrate: number | null): Promise<boolean> {
  const ended = await endIngestSession(supabase, id, nodeId, bitrate === null ? null : Math.round(bitrate));
  if (!ended) return false;

  void endIngestSessionOnWsServer(id);
  if (ended.endedNow) {
    // The node used to send this itself. The auto-switcher drops the session
    // at once instead of waiting for its stats to time out.
    void postInternalBroadcast(ended.user_id, "streamwizard.ingest_session_ended", { session_id: id, node_id: nodeId });
  }
  return true;
}
