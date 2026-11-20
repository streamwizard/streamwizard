import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { decryptToken } from "@repo/supabase/crypto";
import { getOutputKeysForKey } from "@repo/supabase/queries/ingest/ingest";
import { getLiveSessionByWireId } from "@repo/supabase/queries/ingest/live-sessions";
import { getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions/subscriptions";
import { AttemptLimiter } from "@/lib/attempt-limiter";

// An ingest node looks up a StreamWizard Live session by the wire id in the
// phone's first packet and gets the session secret, the owner and the OBS
// output keys back. A session the node may not serve (unknown, expired,
// ended, revoked, key turned off, owner without a Cloud OBS plan) gets the
// same "not_found", so a node can't tell one from another.

/**
 * Lookups that find nothing, per node, against a node probing wire ids. Same
 * shape as keyFailures in sessions.ts: counted before the lookup (so parallel
 * requests can't slip past) and given back when the session is served, so
 * normal streaming never adds up. 60 per 10 minutes, per rest-api replica.
 */
const MISS_LIMIT = 60;
const misses = new AttemptLimiter({ windowMs: 10 * 60 * 1000 });

/** Tests only. */
export function resetLiveSessionMisses(): void {
  misses.clear();
}

export interface LiveSessionForNode {
  session_id: string;
  session_secret: string;
  protocol_version: number;
  user_id: string;
  stream_key_id: string;
  output_keys: string[];
  expires_at: string;
}

export type LookupLiveSessionResult =
  | { ok: true; session: LiveSessionForNode }
  | { ok: false; reason: "not_found" | "failed" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * GET /api/ingest-nodes/live-sessions/:session_id. `wireId` is null when the
 * path held no valid wire id; that counts as a miss like an unknown one.
 */
export async function lookupLiveSession(
  nodeId: string,
  wireId: string | null,
  now: () => number = Date.now,
): Promise<LookupLiveSessionResult> {
  const missKey = `node:${nodeId}`;
  const wait = misses.take([{ key: missKey, limit: MISS_LIMIT }]);
  if (wait !== null) return { ok: false, reason: "rate_limited", retryAfterSeconds: wait };
  if (!wireId) return { ok: false, reason: "not_found" };

  const row = await getLiveSessionByWireId(supabase, wireId);
  if (!row || row.ended_at || row.revoked_at || !row.key_is_active || Date.parse(row.expires_at) <= now()) {
    return { ok: false, reason: "not_found" };
  }
  // The plan is checked again here: losing it turns the keys off, but that
  // sweep runs later than the plan ends.
  if (!(await getUserActiveSubscriptionId(supabase, row.user_id, "cloud_obs"))) {
    return { ok: false, reason: "not_found" };
  }
  misses.refund([missKey]);

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
      expires_at: new Date(row.expires_at).toISOString(),
    },
  };
}
