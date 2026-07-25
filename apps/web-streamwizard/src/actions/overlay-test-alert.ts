"use server";

import { createClient } from "@repo/supabase/next/server";
import { reportError } from "@repo/sentry";
import {
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_EVENT_TYPES,
  type AlertEventType,
} from "@repo/ui/overlay";
import {
  WIDGET_TEST_EVENTS,
  buildWidgetTestEvent,
  isWidgetTestEventType,
} from "@repo/schemas";
import { env } from "@/lib/env";

/**
 * Fires a synthetic event at the signed-in user's overlay WS room via ws-server
 * `/internal/broadcast`. The message uses the real EventSub type, so the native
 * alert widget AND custom widgets react exactly like they would to a live one.
 *
 * `event` arrives from the client, so it is checked against the fixture table
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
  if (!isWidgetTestEventType(event)) {
    return { ok: false, error: "Unknown event type" };
  }

  if (customPayload !== undefined) {
    const parsed = WIDGET_TEST_EVENTS[event].schema.safeParse(customPayload);
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

  if (!env.CONSUMER_SECRET) {
    return { ok: false, error: "Test alerts aren't configured on this server" };
  }

  const msg =
    customPayload === undefined
      ? buildWidgetTestEvent(event)
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
