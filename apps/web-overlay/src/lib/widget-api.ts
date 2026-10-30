import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import { TtlCache } from "@repo/ttl-cache";

/**
 * Shared plumbing for the API routes overlay widgets call from inside their
 * iframe: CORS, bearer-token extraction, and turning a subscriber token into
 * the channel it belongs to.
 */

/**
 * Widget iframes are `sandbox="allow-scripts"` with no `allow-same-origin`, so
 * the document has an opaque origin and its requests carry `Origin: null`.
 * That is the isolation working as intended — author JS must never reach the
 * overlay origin's cookies or storage — so the API answers the opaque origin
 * rather than the sandbox being widened to satisfy CORS.
 *
 * Safe because these routes carry no ambient authority: no cookies, and no
 * `Access-Control-Allow-Credentials`, so a browser will not attach one. Each is
 * authorised by the subscriber token in the Authorization header, which also
 * scopes the answer to a single channel. Anyone able to send `Origin: null`
 * still needs that token, and once they have it the browser was never what was
 * stopping them.
 */
const OPAQUE_ORIGIN = "null";

const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_OVERLAY_URL, // prod overlay URL
    process.env.NEXT_PUBLIC_BASE_URL, // streamwizard dashboard (editor preview)
    OPAQUE_ORIGIN, // sandboxed widget iframe on either of the above
  ].filter(Boolean)
);

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? OPAQUE_ORIGIN;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  // Omitted rather than empty for a disallowed origin. An empty value is still
  // a header the browser has to reject, and it reads in devtools as a broken
  // deployment rather than as a refusal.
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

/**
 * The subscriber token is a secret; prefer the Authorization header so it stays
 * out of URLs and logs. Query token remains supported for widgets written
 * against the original contract.
 */
export function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

/**
 * subscriber_token is always 32 random bytes as lowercase hex (the column
 * default and resetSceneUrl). Routes answer 403 for anything else
 * before it reaches the rate limiter or the database, so a made-up string of
 * any size never gets stored.
 */
export function isPlausibleToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_FORMAT.test(token);
}

/**
 * subscriber_token → the scene's Twitch channel id.
 *
 * This is the only place a broadcaster id may come from. Accepting one from the
 * request would turn every overlay into an open Helix proxy for any channel on
 * Twitch, so the parameter simply does not exist in the API.
 */
/**
 * subscriber_token → the scene owner's user id.
 *
 * Same lookup as broadcasterIdForToken without the Twitch hop, for the routes
 * that key on our own user id rather than a Helix one. As above, the id may
 * only ever come from the token — never from the request.
 */
export async function userIdForToken(token: string): Promise<string | null> {
  const { data: scene } = await getOverlaySceneBySubscriberToken(supabaseAdmin, token);
  return scene?.user_id ?? null;
}

export async function broadcasterIdForToken(token: string): Promise<string | null> {
  const userId = await userIdForToken(token);
  if (!userId) return null;
  return getTwitchUserIdByUserIdMaybe(supabaseAdmin, userId);
}

/**
 * Per-token bucket. Deliberately generous compared with the ws-server's
 * per-IP limit: a widget legitimately makes a burst at load (badges,
 * cheermotes, emotes) and then re-anchors its counters every minute.
 *
 * Per-instance, since it lives in memory — acceptable because the asset cache
 * and the live single-flight already collapse upstream calls regardless of how
 * many viewers get through.
 *
 * Bounded: it used to be a plain Map keyed by whatever token string arrived,
 * unauthenticated, so junk tokens grew it without limit. Now only tokens in
 * the real format are counted (callers check isPlausibleToken first), and the
 * cache evicts its oldest entries past maxEntries.
 */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const buckets = new TtlCache<{ count: number }>({ ttlMs: RATE_WINDOW_MS, maxEntries: 5000 });

export function isRateLimited(token: string): boolean {
  if (!isPlausibleToken(token)) return true;
  const entry = buckets.get(token);
  if (!entry) {
    buckets.set(token, { count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}
