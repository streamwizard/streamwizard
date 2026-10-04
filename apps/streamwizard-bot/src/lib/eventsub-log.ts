import { supabase } from "@repo/supabase";
import { logPlatformEvent, type EmitPlatformEventInput } from "@repo/supabase/queries/platform-events";
import type { EventSubLifecycleEvent } from "@repo/twitch-eventsub";

const SERVICE = "streamwizard-bot";

/** Writes one row straight to `platform_events`. Never throws: logPlatformEvent swallows and reports. */
export function emitEventSubRow(event: EmitPlatformEventInput): Promise<void> {
  return logPlatformEvent(supabase, event, `streamwizard-bot eventsub-log: ${event.type}`);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * Turns receiver lifecycle events into `platform_events` rows so the Discord
 * log channel shows outages, reconnects and session moves (each type has its
 * own toggle in web-admin under /discord/logs/settings). There's no outage
 * threshold here because this is the trail, not the alert.
 *
 * By default every row lands the moment it happens. A process that runs
 * several shards passes the `emit` of an EventSubLogGroup instead, which
 * merges rows from shards that hit the same thing together.
 *
 * `connected` fires for three different things, told apart with local state:
 * the first session after boot, the session after an outage (downtimeMs set),
 * and the session Twitch moved us to (no gap, after session_reconnect_requested).
 */
export function createEventSubLogger(
  shardId?: string,
  emit: (event: EmitPlatformEventInput) => void = (event) => void emitEventSubRow(event),
): (event: EventSubLifecycleEvent) => void {
  let booted = false;
  // Every row names the process and, once the bot runs shards, which one.
  const origin = shardId !== undefined ? { service: SERVICE, shard_id: shardId } : { service: SERVICE };
  let migrating = false;
  let keepaliveSilentMs: number | null = null;

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
          payload: { ...origin, reason: event.reason, close_code: event.code, keepalive_silent_ms: silentMs },
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
              ...origin,
              session_id: event.sessionId,
              downtime_ms: event.downtimeMs,
              attempts: event.attempt,
            },
          });
        } else if (migrating) {
          migrating = false;
          emit({ type: "eventsub.session_migrated", payload: { ...origin, session_id: event.sessionId } });
        } else if (!booted) {
          emit({ type: "eventsub.connected", payload: { ...origin, session_id: event.sessionId } });
        }
        booted = true;
        break;
      }

      case "subscription_revoked":
        emit({
          type: "eventsub.subscription_revoked",
          payload: {
            ...origin,
            subscription_type: event.subscriptionType,
            status: event.status,
            reason: event.reason,
          },
        });
        break;

      case "conduit_update_failed":
        emit({ type: "eventsub.conduit_update_failed", payload: { ...origin, error: errorText(event.error) } });
        break;

      case "reconnect_scheduled":
        // Attempts are counted on the reconnected row.
        break;
    }
  };
}
