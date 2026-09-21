import { trackEventSubConnection } from "@repo/metrics";
import type { EventSubLifecycleEvent } from "@repo/twitch-eventsub";
import { Sentry } from "../sentry";

const SERVICE = "streamwizard-bot";

/**
 * Turns receiver lifecycle events into connection metrics and Sentry
 * breadcrumbs. Alerting lives elsewhere: the fleet alert engine reads the
 * `eventsub_connection` measurement written here (rule `eventsub.disconnected`),
 * and the Discord log channel gets a row per event from eventsub-log.ts. This
 * callback never notifies anyone itself, so an outage produces one alert.
 */
export function createEventSubTelemetry(): (event: EventSubLifecycleEvent) => void {
  return (event: EventSubLifecycleEvent) => {
    switch (event.type) {
      case "connection_lost":
        trackEventSubConnection(SERVICE, "lost");
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Connection lost: ${event.reason}${event.code !== null ? ` (code ${event.code})` : ""}`,
          level: "warning",
        });
        break;

      case "keepalive_timeout":
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Keepalive timeout after ${event.silentForMs}ms of silence`,
          level: "warning",
        });
        break;

      case "reconnect_scheduled":
        trackEventSubConnection(SERVICE, "reconnect_attempt", { attempt: event.attempt });
        break;

      case "connected":
        trackEventSubConnection(SERVICE, "connected", {
          downtimeMs: event.downtimeMs ?? undefined,
          attempt: event.attempt,
        });
        break;

      case "session_reconnect_requested":
        Sentry.addBreadcrumb({ category: "eventsub", message: "Twitch requested session reconnect", level: "info" });
        break;

      case "subscription_revoked":
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Subscription revoked: ${event.subscriptionType} (${event.status}) ${event.reason}`,
          level: "warning",
        });
        break;

      case "conduit_update_failed":
        // The socket is up but unbound, so events silently stop. A real error
        // for Sentry; the log channel row says the same to staff.
        Sentry.captureException(event.error);
        break;
    }
  };
}
