import { NextRequest, NextResponse } from "next/server";
import { configureTracking, trackServer } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import { TtlCache } from "@repo/ttl-cache";
import { HEARTBEAT_SECONDS, parseBeacon } from "@/lib/telemetry";
import { bearerToken } from "@/lib/widget-api";

/**
 * Where a rendered overlay reports that it is loaded and still running.
 *
 * It is the only way to know an overlay is in use at all: an OBS browser
 * source never answers a cookie banner, so nothing client-side reaches
 * PostHog from it, and the editor only knows what was configured. The page
 * posts here instead and the event is recorded server-side, under the
 * overlay owner's account id.
 *
 * Same-origin only, so no CORS headers: the widget routes answer sandboxed
 * iframes, this one answers the overlay page itself.
 */

configureTracking({
  app: "web-overlay",
  onError: (error) => reportError(error, "api/telemetry: posthog"),
});

// Everything this route remembers lives in these three caches. All are bounded
// and expire lazily, with no timer: this process once grew to 11 GB, and a
// route hit by every open overlay every few minutes must not be how it happens
// again.
const scenes = new TtlCache<{ id: string; userId: string }>({
  ttlMs: 10 * 60_000,
  negativeTtlMs: 60_000,
  maxEntries: 2000,
});
// OBS can reload a source every time its scene becomes active. That is one
// overlay being used, not twenty loads.
const recentLoads = new TtlCache<true>({ ttlMs: 10 * 60_000, maxEntries: 2000 });
// Its own bucket, far tighter than the widget API's: a beacon is due every few
// minutes, and sharing a budget would let one starve the other.
const requestCounts = new TtlCache<{ count: number }>({ ttlMs: 60_000, maxEntries: 5000 });
const MAX_REQUESTS_PER_MINUTE = 4;
const MAX_BODY_BYTES = 2048;

function isRateLimited(token: string): boolean {
  const entry = requestCounts.get(token);
  if (!entry) {
    requestCounts.set(token, { count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS_PER_MINUTE;
}

const NO_STORE = { "Cache-Control": "no-store" };

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return refuse("Missing token", 400);
  if (isRateLimited(token)) return refuse("Too many requests", 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return refuse("Body too large", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse("Invalid JSON", 400);
  }
  const beacon = parseBeacon(body);
  if (!beacon) return refuse("Invalid beacon", 400);

  let scene: { id: string; userId: string } | null;
  try {
    scene = await scenes.fetch(token, async () => {
      const { data, error } = await getOverlaySceneBySubscriberToken(supabaseAdmin, token);
      if (error) throw error;
      return data ? { id: data.id, userId: data.user_id } : null;
    });
  } catch (error) {
    reportError(error, "api/telemetry: scene lookup");
    return refuse("Lookup failed", 503);
  }
  if (!scene) return refuse("Not found or unauthorized", 403);

  if (beacon.kind === "load") {
    if (!recentLoads.get(token)) {
      recentLoads.set(token, true);
      trackServer(scene.userId, "overlay_loaded", { overlay_id: scene.id, ...beacon.properties }, { request: req });
    }
  } else {
    trackServer(scene.userId, "overlay_heartbeat", { overlay_id: scene.id, ...beacon.properties }, { request: req });
  }

  return NextResponse.json({ next: HEARTBEAT_SECONDS }, { headers: NO_STORE });
}
