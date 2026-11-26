import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { decryptToken } from "@repo/supabase/crypto";
import { getOutputKeysForKey } from "@repo/supabase/queries/ingest/ingest";
import { getLiveSessionByWireId, type LiveSessionLookup } from "@repo/supabase/queries/ingest/live-sessions";
import { getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions/subscriptions";
import { TtlCache } from "@repo/ttl-cache";
import { AttemptLimiter } from "@/lib/attempt-limiter";
import { TokenBucketLimiter } from "@/lib/token-bucket";
import { sessionLatencyMs } from "@/modules/live-sessions/latency";

// An ingest node looks up a StreamWizard Live session by the wire id in the
// phone's first packet and gets the session secret, the owner and the OBS
// output keys back. A session the node may not serve (unknown, expired,
// ended, revoked, key turned off, owner without a Cloud OBS plan) is a miss:
// all misses get the same answer (404, or 429 over the miss limit), so a node
// can't tell one from another.

/**
 * Lookups that find nothing, per node, as an alarm for a node probing wire
 * ids (SWIRL-142 / SWIRL-180). 60 per 10-minute fixed window, from the first
 * miss, per rest-api replica. Only misses count: the database is read first,
 * and a miss is counted right after (no await in between, so parallel
 * requests can't slip past). Over the limit a miss gets 429 instead of 404,
 * is not counted and doesn't extend the window, and the first refusal in a
 * window is reported once.
 *
 * A session the node may serve is always served, whatever the miss count:
 * wire ids are 64 random bits, so answering valid ids while a node is over
 * its limit gives a prober nothing, and refusing them would let junk
 * lookups take a node offline for every phone.
 */
const MISS_LIMIT = 60;
const misses = new AttemptLimiter({ windowMs: 10 * 60 * 1000 });
/** Node key -> end of the miss window already reported, so each window reports once. */
const reportedWindows = new TtlCache<number>({ ttlMs: 10 * 60 * 1000 });

/**
 * Load limit, per node, on every lookup (valid ones too), checked before the
 * database read: 30 a second, bursts of 100, per rest-api replica. A
 * refused request is not a miss.
 */
const requests = new TokenBucketLimiter({ ratePerSecond: 30, burst: 100 });

/** Tests only. */
export function resetLiveSessionLookupLimits(): void {
  misses.clear();
  reportedWindows.clear();
  requests.clear();
}

export interface LiveSessionForNode {
  session_id: string;
  session_secret: string;
  protocol_version: number;
  user_id: string;
  stream_key_id: string;
  output_keys: string[];
  /**
   * When the session was created. A restarted node refuses sessions created
   * before it started: an earlier process may have used their keys.
   */
  created_at: string;
  expires_at: string;
  /**
   * The session's latency budget in ms: the value the phone got when it
   * created the session, unless a restart changed LIVE_LATENCY_MS since
   * (latency.ts). The node uses it for this session.
   */
  latency_ms: number;
}

export type LookupLiveSessionResult =
  | { ok: true; session: LiveSessionForNode }
  | { ok: false; reason: "not_found" | "failed" }
  | { ok: false; reason: "too_many_misses" | "too_many_requests"; retryAfterSeconds: number };

/** The row when the node may serve it now, else null. */
async function findServableSession(wireId: string, now: () => number): Promise<LiveSessionLookup | null> {
  const row = await getLiveSessionByWireId(supabase, wireId);
  if (!row || row.ended_at || row.revoked_at || !row.key_is_active || Date.parse(row.expires_at) <= now()) {
    return null;
  }
  // The plan is checked again here: losing it turns the keys off, but that
  // sweep runs later than the plan ends.
  if (!(await getUserActiveSubscriptionId(supabase, row.user_id, "cloud_obs"))) return null;
  return row;
}

/**
 * Counts a miss, or refuses it over the limit. Synchronous: the caller
 * decides "miss" and calls this with no await in between.
 */
function countMiss(nodeId: string, nodeKey: string): LookupLiveSessionResult {
  const wait = misses.take([{ key: nodeKey, limit: MISS_LIMIT }]);
  if (wait === null) return { ok: false, reason: "not_found" };

  const windowEnd = misses.windowEndsAt(nodeKey);
  if (windowEnd !== null && reportedWindows.get(nodeKey) !== windowEnd) {
    reportedWindows.set(nodeKey, windowEnd, { expiresAt: windowEnd });
    // The node id only: never the looked-up wire id, a secret or a key.
    reportError(new Error("ingest node over its live session miss limit"), "live-sessions.miss-limit", {
      node_id: nodeId,
    });
  }
  return { ok: false, reason: "too_many_misses", retryAfterSeconds: wait };
}

/**
 * GET /api/ingest-nodes/live-sessions/:session_id. `wireId` is null when the
 * path held no valid wire id; that counts as a miss like an unknown one.
 */
export async function lookupLiveSession(
  nodeId: string,
  wireId: string | null,
  now: () => number = Date.now,
): Promise<LookupLiveSessionResult> {
  const nodeKey = `node:${nodeId}`;
  const busyWait = requests.take(nodeKey);
  if (busyWait !== null) return { ok: false, reason: "too_many_requests", retryAfterSeconds: busyWait };

  const row = wireId ? await findServableSession(wireId, now) : null;
  if (!row) return countMiss(nodeId, nodeKey);

  const outputs = await getOutputKeysForKey(supabase, row.key_id);
  if (outputs.error) return { ok: false, reason: "failed" };

  let secret: string;
  try {
    secret = decryptToken(row.secret_ciphertext, row.secret_iv, row.secret_tag);
  } catch {
    // Wrong TOKEN_ENCRYPTION_KEY or a damaged row. The cause stays out of
    // the report: it carries no detail worth the risk.
    reportError(new Error("live session secret could not be decrypted"), "live-sessions.decrypt", {
      node_id: nodeId,
      session_id: row.wire_id,
    });
    return { ok: false, reason: "failed" };
  }

  return {
    ok: true,
    session: {
      session_id: row.wire_id,
      session_secret: secret,
      protocol_version: row.protocol_version,
      user_id: row.user_id,
      stream_key_id: row.key_id,
      output_keys: (outputs.data ?? []).map((o) => o.output_key),
      created_at: new Date(row.created_at).toISOString(),
      expires_at: new Date(row.expires_at).toISOString(),
      latency_ms: sessionLatencyMs(),
    },
  };
}
