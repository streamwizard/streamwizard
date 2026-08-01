import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";

/**
 * Shared plumbing for the API routes overlay widgets call from inside their
 * iframe: CORS, bearer-token extraction, and turning a subscriber token into
 * the channel it belongs to.
 */

const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_OVERLAY_URL, // prod overlay URL
    process.env.NEXT_PUBLIC_BASE_URL, // streamwizard dashboard (editor preview)
  ].filter(Boolean)
);

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "null";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
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

/**
 * subscriber_token → the scene's Twitch channel id.
 *
 * This is the only place a broadcaster id may come from. Accepting one from the
 * request would turn every overlay into an open Helix proxy for any channel on
 * Twitch, so the parameter simply does not exist in the API.
 */
export async function broadcasterIdForToken(token: string): Promise<string | null> {
  const { data: scene } = await supabaseAdmin
    .from("overlay_scenes")
    .select("user_id")
    .eq("subscriber_token", token)
    .maybeSingle();

  if (!scene?.user_id) return null;

  return getTwitchUserIdByUserIdMaybe(supabaseAdmin, scene.user_id);
}

/**
 * Per-token bucket. Deliberately generous compared with the ws-server's
 * per-IP limit: a widget legitimately makes a burst at load (badges,
 * cheermotes, emotes) and then re-anchors its counters every minute.
 *
 * Per-instance, since it lives in memory — acceptable because the asset cache
 * and the live single-flight already collapse upstream calls regardless of how
 * many viewers get through.
 */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(token: string): boolean {
  const now = Date.now();
  const entry = buckets.get(token);
  if (!entry || now > entry.resetAt) {
    buckets.set(token, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Bounded cleanup so a long-lived server doesn't accumulate dead tokens.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(token);
  }
}, RATE_WINDOW_MS).unref?.();
