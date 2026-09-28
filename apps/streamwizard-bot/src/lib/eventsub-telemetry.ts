import { trackEventSubConnection, trackEventSubRevocation, trackEventSubShard } from "@repo/metrics";
import type { EventSubLifecycleEvent, EventSubReceiverStats } from "@repo/twitch-eventsub";
import { Sentry } from "../sentry";

const SERVICE = "streamwizard-bot";

/**
 * Turns one shard's lifecycle events into connection metrics and Sentry
 * breadcrumbs. Alerting lives elsewhere: the fleet alert engine reads the
 * `eventsub_connection` measurement written here (rule `eventsub.disconnected`),
 * and the Discord log channel gets a row per event from eventsub-log.ts. This
 * callback never notifies anyone itself, so an outage produces one alert.
 */
export function createEventSubTelemetry(shardId = "0"): (event: EventSubLifecycleEvent) => void {
  return (event: EventSubLifecycleEvent) => {
    switch (event.type) {
      case "connection_lost":
        trackEventSubConnection(SERVICE, "lost", { shardId });
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Shard ${shardId} connection lost: ${event.reason}${event.code !== null ? ` (code ${event.code})` : ""}`,
          level: "warning",
        });
        break;

      case "keepalive_timeout":
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Shard ${shardId} keepalive timeout after ${event.silentForMs}ms of silence`,
          level: "warning",
        });
        break;

      case "reconnect_scheduled":
        trackEventSubConnection(SERVICE, "reconnect_attempt", { attempt: event.attempt, shardId });
        break;

      case "connected":
        trackEventSubConnection(SERVICE, "connected", {
          downtimeMs: event.downtimeMs ?? undefined,
          attempt: event.attempt,
          shardId,
        });
        break;

      case "session_reconnect_requested":
        Sentry.addBreadcrumb({ category: "eventsub", message: `Twitch requested session reconnect on shard ${shardId}`, level: "info" });
        break;

      case "subscription_revoked":
        trackEventSubRevocation(SERVICE, event.subscriptionType, "websocket");
        Sentry.addBreadcrumb({
          category: "eventsub",
          message: `Subscription revoked: ${event.subscriptionType} (${event.status}) ${event.reason}`,
          level: "warning",
        });
        break;

      case "conduit_update_failed":
        // The socket is up but unbound, so events silently stop. A real error
        // for Sentry; the log channel row says the same to staff.
        Sentry.captureException(event.error, { tags: { eventsub_shard: shardId } });
        break;
    }
  };
}

/**
 * Writes one `eventsub_shard` point per shard from a manager snapshot.
 * Counters in the snapshot are cumulative, so this keeps the previous value
 * per shard and writes the difference.
 */
export function createShardHeartbeat(): (snapshot: EventSubReceiverStats[]) => void {
  const previous = new Map<string, { messages: number; notifications: number }>();
  return (snapshot) => {
    const now = Date.now();
    for (const stats of snapshot) {
      const prev = previous.get(stats.shardId) ?? { messages: 0, notifications: 0 };
      previous.set(stats.shardId, { messages: stats.counters.messages, notifications: stats.counters.notifications });
      trackEventSubShard(SERVICE, {
        shardId: stats.shardId,
        state: stats.state,
        sessionId: stats.sessionId,
        messagesDelta: stats.counters.messages - prev.messages,
        notificationsDelta: stats.counters.notifications - prev.notifications,
        lastMessageAgeMs: now - stats.lastMessageAt,
        reconnectAttempts: stats.reconnectAttempts,
        sessionAgeS: stats.sessionStartedAt !== null ? (now - stats.sessionStartedAt) / 1000 : null,
        conduitMissing: stats.conduitMissing,
      });
    }
  };
}
