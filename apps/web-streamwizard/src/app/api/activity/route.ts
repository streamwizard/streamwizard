import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@repo/supabase/next/server";
import { TtlCache } from "@repo/ttl-cache";
import { isRelayedEvent, RELAYED_EVENTS } from "@/lib/activity-events";
import { track } from "@/lib/track";

/**
 * POST /api/activity — the dashboard reporting an action that no server action
 * sees. See lib/activity-events.ts for which ones and why.
 *
 * A route handler rather than a server action: Next runs a client's server
 * actions one at a time, so a tracking action would queue in front of Save.
 * Named "activity" because "track", "analytics" and "collect" are on every
 * ad-block list.
 *
 * It only ever writes an analytics event about the caller's own account, but
 * it is still a cookie-authenticated POST, so it refuses cross-site callers,
 * unknown events, oversized bodies and anyone sending more than a person
 * clicking could.
 */

const MAX_BODY_BYTES = 2048;
const MAX_REQUESTS_PER_MINUTE = 30;
const requestCounts = new TtlCache<{ count: number }>({ ttlMs: 60_000, maxEntries: 5000 });

function isRateLimited(userId: string): boolean {
  const entry = requestCounts.get(userId);
  if (!entry) {
    requestCounts.set(userId, { count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS_PER_MINUTE;
}

// Browsers put Sec-Fetch-Site on every fetch and a page cannot forge it. The
// few that predate the header fall back to comparing Origin with our own host.
function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return refuse("Forbidden", 403);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return refuse("Body too large", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse("Invalid JSON", 400);
  }
  if (typeof body !== "object" || body === null) return refuse("Invalid body", 400);
  const { event, properties: input } = body as { event?: unknown; properties?: unknown };
  if (!isRelayedEvent(event)) return refuse("Unknown event", 400);
  const properties = RELAYED_EVENTS[event](
    typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {},
  );
  if (!properties) return refuse("Invalid properties", 400);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return refuse("Unauthorized", 401);
  if (isRateLimited(claims.sub)) return refuse("Too many requests", 429);

  await track(
    event,
    properties,
    { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null },
    { relayed: true },
  );
  return new NextResponse(null, { status: 204 });
}
