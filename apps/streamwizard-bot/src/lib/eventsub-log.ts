import { supabase } from "@repo/supabase";
import { logPlatformEvent, type EmitPlatformEventInput } from "@repo/supabase/queries/platform-events";
import type { EventSubLifecycleEvent } from "@repo/twitch-eventsub";

const SERVICE = "streamwizard-bot";

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * Turns receiver lifecycle events into `platform_events` rows so the Discord
 * log channel shows outages, reconnects and session moves (each type has its
 * own toggle in web-admin under /discord/logs/settings). Every row lands the
 * moment it happens; there's no outage threshold here because this is the
 * trail, not the alert. Never throws: logPlatformEvent swallows and reports.
 *
 * `connected` fires for three different things, told apart with local state:
 * the first session after boot, the session after an outage (downtimeMs set),
 * and the session Twitch moved us to (no gap, after session_reconnect_requested).
 */
export function createEventSubLogger(): (event: EventSubLifecycleEvent) => void {
  let booted = false;
  let migrating = false;
  let keepaliveSilentMs: number | null = null;

  const emit = (event: EmitPlatformEventInput) => {
    void logPlatformEvent(supabase, event, `streamwizard-bot eventsub-log: ${event.type}`);
  };

  return (event: EventSubLifecycleEvent) => {
    switch (event.type) {
      case "keepalive_timeout":
        // connection_lost follows straight away; remember why for that row.
        keepaliveSilentMs = event.silentForMs;
        break;

      case "connection_lost": {
        const silentMs = keepaliveSilentMs;
        keepaliveSilentMs = null;
        migrating = false;
        emit({
          type: "eventsub.connection_lost",
          payload: { service: SERVICE, reason: event.reason, close_code: event.code, keepalive_silent_ms: silentMs },
        });
        break;
      }

      case "session_reconnect_requested":
        migrating = true;
        break;

      case "connected": {
        if (event.downtimeMs !== null) {
          migrating = false;
          emit({
            type: "eventsub.reconnected",
            payload: {
              service: SERVICE,
              session_id: event.sessionId,
              downtime_ms: event.downtimeMs,
              attempts: event.attempt,
            },
          });
        } else if (migrating) {
          migrating = false;
          emit({ type: "eventsub.session_migrated", payload: { service: SERVICE, session_id: event.sessionId } });
        } else if (!booted) {
          emit({ type: "eventsub.connected", payload: { service: SERVICE, session_id: event.sessionId } });
        }
        booted = true;
        break;
      }

      case "subscription_revoked":
        emit({
          type: "eventsub.subscription_revoked",
          payload: {
            service: SERVICE,
            subscription_type: event.subscriptionType,
            status: event.status,
            reason: event.reason,
          },
        });
        break;

      case "conduit_update_failed":
        emit({ type: "eventsub.conduit_update_failed", payload: { service: SERVICE, error: errorText(event.error) } });
        break;

      case "reconnect_scheduled":
        // Attempts are counted on the reconnected row.
        break;
    }
  };
}
