"use server";

import { createClient } from "@repo/supabase/next/server";
import { reportError } from "@repo/sentry";
import {
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_EVENT_TYPES,
  type AlertEventType,
} from "@repo/ui/overlay";
import { DEMO_EVENTS, buildDemoEvent, isDemoEventType } from "@repo/schemas";
import { env } from "@/lib/env";

/**
 * A looping simulator in Live mode is one round trip per tick, per open editor
 * tab. Without a ceiling a streamer can quietly flood their own ws-server just
 * by leaving the panel running. Generous enough that no hand-firing hits it.
 */
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Per server instance, not per cluster -- this is a guard rail against a stuck
// loop, not a security control. The allowlist above is the security control.
const rateLimitByUser = new Map<string, { count: number; windowStart: number }>();

function withinRateLimit(userId: string, now: number): boolean {
  const entry = rateLimitByUser.get(userId);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitByUser.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

/**
 * Fires a synthetic event at the signed-in user's overlay WS room via ws-server
 * `/internal/broadcast`. The message uses the real listener string, so the
 * native alert widget AND custom widgets react exactly like they would to a
 * live one -- and every overlay the user has open sees it, not just the editor
 * preview.
 *
 * `event` arrives from the client, so it is checked against the demo catalogue
 * rather than trusted -- that table is the allowlist of broadcastable types.
 */
export async function sendTestEventToOverlay(
  event: string,
  /**
   * Optional hand-edited payload from the widget editor. Validated against the
   * event's own zod schema before it goes anywhere, so a typo surfaces as an
   * error instead of a malformed frame reaching live overlays.
   */
  customPayload?: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!isDemoEventType(event)) {
    return { ok: false, error: "Unknown event type" };
  }

  if (customPayload !== undefined) {
    const parsed = DEMO_EVENTS[event].schema.safeParse(customPayload);
    if (!parsed.success) {
      return { ok: false, error: `Payload doesn't match ${event}` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  if (!withinRateLimit(user.id, Date.now())) {
    return { ok: false, error: "Too many test events — slow down for a minute" };
  }

  if (!env.CONSUMER_SECRET) {
    return { ok: false, error: "Test alerts aren't configured on this server" };
  }

  const msg =
    customPayload === undefined
      ? buildDemoEvent(event)
      : { type: event, payload: customPayload };
  const httpUrl = env.WS_SERVER_URL.replace(/^ws:/, "http:").replace(/^wss:/, "https:");

  try {
    const res = await fetch(`${httpUrl}/internal/broadcast`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CONSUMER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: user.id, type: msg.type, payload: msg.payload }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      return { ok: false, error: "Could not reach the overlay server" };
    }
    return { ok: true };
  } catch (error) {
    reportError(error, "overlay: test alert broadcast");
    return { ok: false, error: "Could not reach the overlay server" };
  }
}

/** Alert-inspector entry point: takes a configurable alert category, not an EventSub type. */
export async function sendTestAlertToOverlay(
  event: AlertEventType
): Promise<{ ok: boolean; error?: string }> {
  if (!ALERT_EVENT_TYPES.includes(event)) {
    return { ok: false, error: "Unknown alert type" };
  }
  return sendTestEventToOverlay(ALERT_EVENT_SUBSCRIPTION_TYPES[event]);
}
