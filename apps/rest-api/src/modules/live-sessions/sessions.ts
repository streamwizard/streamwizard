import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import { getStreamKeyOwner } from "@repo/supabase/queries/ingest/ingest";
import { createLiveSession as insertLiveSession, endLiveSessionForUser } from "@repo/supabase/queries/ingest/live-sessions";
import { env } from "@/env";
import { AttemptLimiter } from "@/lib/attempt-limiter";
import { ipAddress } from "@/lib/node-schemas";
import { newSessionSecret, newWireId } from "@/modules/live-sessions/credentials";
import { sessionLatencyMs } from "@/modules/live-sessions/latency";
import type { LiveIngestEndpoint } from "@/schemas/env";

// The phone app opens a live session with one of the signed-in user's stream
// keys and gets a wire id, a secret and the ingest addresses back. The key
// must be active, the user's own, and its owner must hold a Cloud OBS plan;
// every refusal is the same "invalid_key", so a caller can't tell an unknown
// key from someone else's. A new session revokes the key's open ones.
//
// A session lasts LIVE_SESSION_LIFETIME_S (at most 24 h).
//
// The session secret and the stream key never reach a log, an error report
// or a URL.

/** Bonded protocol version the sessions are opened for. */
export const LIVE_PROTOCOL_VERSION = 1;

/**
 * Rate limits, per rest-api replica (TtlCache counters, like the ingest
 * node's keyFailures). A real phone opens a session per stream, so these
 * only bite on a loop or someone probing keys.
 *
 * Creates: 10 a minute per user, 5 a minute per stream key, 30 a minute per
 * IP (several phones behind one carrier NAT). Invalid keys: 10 per 10
 * minutes per user, 20 per 10 minutes per IP. Every attempt is counted
 * before the key lookup, so parallel requests can't slip past; a valid key
 * gives its invalid-key attempt back.
 */
const CREATE_WINDOW_MS = 60 * 1000;
const CREATES_PER_USER = 10;
const CREATES_PER_KEY = 5;
const CREATES_PER_IP = 30;
const INVALID_KEY_WINDOW_MS = 10 * 60 * 1000;
const INVALID_KEYS_PER_USER = 10;
const INVALID_KEYS_PER_IP = 20;

const creates = new AttemptLimiter({ windowMs: CREATE_WINDOW_MS });
const invalidKeys = new AttemptLimiter({ windowMs: INVALID_KEY_WINDOW_MS });

/** Tests only. */
export function resetLiveSessionLimits(): void {
  creates.clear();
  invalidKeys.clear();
}

/** A wire id collision is a 1-in-2^64 event; a few retries are plenty. */
const MAX_WIRE_ID_ATTEMPTS = 3;
const UNIQUE_VIOLATION = "23505";

export interface CreatedLiveSession {
  session_id: string;
  session_secret: string;
  protocol_version: number;
  ingest: LiveIngestEndpoint[];
  expires_at: string;
  /** Whole seconds from now until expires_at, never negative. */
  expires_in: number;
  /** The session's latency budget in ms; the node lookup states the same (latency.ts). */
  latency_ms: number;
}

/** A session's expiry as the create and renew answers state it. */
export interface LiveSessionExpiry {
  /** ISO 8601, UTC, milliseconds. */
  expires_at: string;
  expires_in: number;
}

/**
 * expires_at as ISO 8601 UTC and the whole seconds until then (rounded
 * down, so a phone never waits past it; 0 once it has passed).
 */
function sessionExpiry(expiresAt: string, now: number): LiveSessionExpiry {
  const at = new Date(expiresAt);
  return { expires_at: at.toISOString(), expires_in: Math.max(0, Math.floor((at.getTime() - now) / 1000)) };
}

export type CreateLiveSessionResult =
  | { ok: true; session: CreatedLiveSession }
  | { ok: false; reason: "unavailable" | "invalid_key" | "failed" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export interface CreateLiveSessionInput {
  userId: string;
  streamKey: string;
  /** The caller's IP (clientIp), for the per-IP limits and the row. */
  ip: string;
}

/** POST /api/live/sessions */
export async function createLiveSession({ userId, streamKey, ip }: CreateLiveSessionInput): Promise<CreateLiveSessionResult> {
  const ingest = env.LIVE_INGEST_ENDPOINTS;
  if (ingest.length === 0) return { ok: false, reason: "unavailable" };

  const userKey = `user:${userId}`;
  const ipKey = `ip:${ip}`;
  const createWait = creates.take([
    { key: userKey, limit: CREATES_PER_USER },
    { key: ipKey, limit: CREATES_PER_IP },
  ]);
  if (createWait !== null) return { ok: false, reason: "rate_limited", retryAfterSeconds: createWait };
  const invalidWait = invalidKeys.take([
    { key: userKey, limit: INVALID_KEYS_PER_USER },
    { key: ipKey, limit: INVALID_KEYS_PER_IP },
  ]);
  if (invalidWait !== null) return { ok: false, reason: "rate_limited", retryAfterSeconds: invalidWait };

  const owner = await getStreamKeyOwner(supabase, streamKey, "cloud_obs");
  if (!owner || owner.user_id !== userId) return { ok: false, reason: "invalid_key" };
  invalidKeys.refund([userKey, ipKey]);

  const keyWait = creates.take([{ key: `key:${owner.key_id}`, limit: CREATES_PER_KEY }]);
  if (keyWait !== null) return { ok: false, reason: "rate_limited", retryAfterSeconds: keyWait };

  const secret = newSessionSecret();
  const encrypted = encryptToken(secret);
  const createdIp = ipAddress.safeParse(ip).success ? ip : null;

  for (let attempt = 0; attempt < MAX_WIRE_ID_ATTEMPTS; attempt++) {
    const { data, error } = await insertLiveSession(supabase, {
      user_id: userId,
      key_id: owner.key_id,
      stream_key: streamKey,
      wire_id: newWireId(),
      secret_ciphertext: encrypted.ciphertext,
      secret_iv: encrypted.iv,
      secret_tag: encrypted.authTag,
      protocol_version: LIVE_PROTOCOL_VERSION,
      created_ip: createdIp,
      lifetime_s: env.LIVE_SESSION_LIFETIME_S,
    });
    if (error?.code === UNIQUE_VIOLATION) continue;
    if (error) {
      // Only the code: a database error's detail can echo the row's values.
      reportError(new Error(`create_live_session failed (${error.code})`), "live-sessions.create", { user_id: userId });
      return { ok: false, reason: "failed" };
    }
    // The key was rotated or turned off between the check and the insert.
    if (!data) return { ok: false, reason: "invalid_key" };
    return {
      ok: true,
      session: {
        session_id: data.wire_id,
        session_secret: secret,
        protocol_version: LIVE_PROTOCOL_VERSION,
        ingest,
        ...sessionExpiry(data.expires_at, Date.now()),
        latency_ms: sessionLatencyMs(),
      },
    };
  }
  reportError(new Error("create_live_session kept hitting taken wire ids"), "live-sessions.create", { user_id: userId });
  return { ok: false, reason: "failed" };
}

/**
 * POST /api/live/sessions/:session_id/end
 * → true, also when it had already ended or was revoked
 * → false when the user has no session with this id
 */
export async function endLiveSession(userId: string, wireId: string): Promise<boolean> {
  return (await endLiveSessionForUser(supabase, wireId, userId)) !== null;
}
