"use server";

import { reportError } from "@repo/sentry";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  buildDemoEvent,
  isDemoEventType,
} from "@repo/schemas/widgets/demo-events";
import { broadcastToUser } from "@repo/ws-client";
import { ALERT_TEST_PAYLOAD_KEY, type AlertForcedVariation } from "@repo/ui/overlay";
import { env } from "@/lib/env";
import { tryAuthContext } from "@/lib/auth";
import { testOverlayEventSchema } from "@/schemas/overlay-actions";

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

// In the demo catalogue so editor previews can render it, but on the wire it is
// a control-plane message: obs-auto-switcher reads it off the consumer feed.
// Only the config save actions may send it.
const NOT_BROADCASTABLE = new Set<string>(["streamwizard.auto_switcher_config"]);

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
  customPayload?: unknown,
  /**
   * Picks an alternate payload for the same listener -- which chat notice to
   * send, for instance. Checked against the event's own variant table for the
   * same reason `event` is checked against the catalogue.
   */
  variant?: string,
  /**
   * Asks one alert box to play one of its variations outright. Only ever two
   * ids, checked for shape here: the overlay looks them up in its own config,
   * so a made-up pair simply matches nothing.
   */
  forceVariation?: AlertForcedVariation
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  const { user } = ctx;

  const parsed = testOverlayEventSchema.safeParse({ event, customPayload, variant, forceVariation });
  if (!parsed.success) return { ok: false, error: "That test event isn't valid" };
  const input = parsed.data;

  if (!isDemoEventType(input.event)) {
    return { ok: false, error: "Unknown event type" };
  }
  const eventType = input.event;
  if (NOT_BROADCASTABLE.has(eventType)) {
    return { ok: false, error: "This event can't be sent as a test" };
  }

  // DEMO_EVENT_DEFS is the widened view; DEMO_EVENTS keeps its literal types,
  // so only some of its members declare `variants` at all.
  if (input.variant !== undefined && !DEMO_EVENT_DEFS[eventType].variants?.[input.variant]) {
    return { ok: false, error: "Unknown event variant" };
  }

  let payloadOverride: unknown;
  if (input.customPayload !== undefined) {
    const payload = DEMO_EVENTS[eventType].schema.safeParse(input.customPayload);
    if (!payload.success) {
      return { ok: false, error: `Payload doesn't match ${eventType}` };
    }
    payloadOverride = payload.data;
  }

  if (!withinRateLimit(user.id, Date.now())) {
    return { ok: false, error: "Too many test events — slow down for a minute" };
  }

  const msg =
    payloadOverride === undefined
      ? buildDemoEvent(eventType, undefined, input.variant)
      : { type: eventType, payload: payloadOverride };
  const payload = input.forceVariation
    ? { ...(msg.payload as Record<string, unknown>), [ALERT_TEST_PAYLOAD_KEY]: input.forceVariation }
    : msg.payload;
  const result = await broadcastToUser(user.id, msg.type, payload, { wsServerUrl: env.WS_SERVER_URL });
  if (result.ok) return { ok: true };
  if (result.reason === "unconfigured") return { ok: false, error: "Test alerts aren't configured on this server" };
  if (result.reason === "network" || result.reason === "signing") reportError(result.error, "overlay: test alert broadcast");
  return { ok: false, error: "Could not reach the overlay server" };
}
