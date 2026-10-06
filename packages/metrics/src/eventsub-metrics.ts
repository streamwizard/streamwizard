import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

/** How an EventSub message reached us: rest-api's webhook or the bot's conduit sockets. */
export type EventSubTransport = "webhook" | "websocket";

/** One notification. No shard tag on purpose: event_type × shard would blow up series. */
export function trackEventSubReceived(
  service: string,
  eventType: string,
  handled: boolean,
  transport: EventSubTransport,
): void {
  pushPoint(
    new Point("eventsub_event")
      .tag("service", service)
      .tag("event_type", eventType)
      .tag("handled", String(handled))
      .tag("transport", transport)
      .intField("count", 1),
  );
}

export function trackEventSubRevocation(service: string, eventType: string, transport: EventSubTransport): void {
  pushPoint(
    new Point("eventsub_revocation")
      .tag("service", service)
      .tag("event_type", eventType)
      .tag("transport", transport)
      .intField("count", 1),
  );
}

export function trackEventSubConnection(
  service: string,
  event: "connected" | "lost" | "reconnect_attempt",
  fields?: { downtimeMs?: number; attempt?: number; shardId?: string },
): void {
  const point = new Point("eventsub_connection")
    .tag("service", service)
    .tag("event", event)
    .intField("count", 1);
  if (fields?.shardId !== undefined) point.tag("shard_id", fields.shardId);
  if (fields?.downtimeMs !== undefined) point.intField("downtime_ms", Math.round(fields.downtimeMs));
  if (fields?.attempt !== undefined) point.intField("attempt", fields.attempt);
  pushPoint(point);
}

/** Connection state as a number so it can be charted and aggregated. */
export const EVENTSUB_STATE_CODE = {
  disconnected: 0,
  connecting: 1,
  reconnecting: 2,
  connected: 3,
} as const;

export interface EventSubShardHeartbeat {
  shardId: string;
  state: keyof typeof EVENTSUB_STATE_CODE;
  sessionId: string | null;
  /** Messages and notifications since the previous heartbeat */
  messagesDelta: number;
  notificationsDelta: number;
  lastMessageAgeMs: number;
  reconnectAttempts: number;
  /** Null while no session is up */
  sessionAgeS: number | null;
  conduitMissing: boolean;
}

/**
 * One point per shard every heartbeat (30s). The alert engine treats a gap in
 * these as a dead process; the admin dashboard charts throughput from the
 * deltas. session_id is a field, not a tag: it changes on every reconnect.
 */
export function trackEventSubShard(service: string, beat: EventSubShardHeartbeat): void {
  const point = new Point("eventsub_shard")
    .tag("service", service)
    .tag("shard_id", beat.shardId)
    .intField("connected", beat.state === "connected" ? 1 : 0)
    .intField("state_code", EVENTSUB_STATE_CODE[beat.state])
    .intField("messages", beat.messagesDelta)
    .intField("notifications", beat.notificationsDelta)
    .intField("last_message_age_ms", Math.max(0, Math.round(beat.lastMessageAgeMs)))
    .intField("reconnect_attempts", beat.reconnectAttempts)
    .intField("conduit_missing", beat.conduitMissing ? 1 : 0);
  if (beat.sessionAgeS !== null) point.intField("session_age_s", Math.round(beat.sessionAgeS));
  if (beat.sessionId) point.stringField("session_id", beat.sessionId);
  pushPoint(point);
}
