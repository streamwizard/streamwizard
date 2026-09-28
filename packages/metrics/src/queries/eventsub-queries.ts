import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// EventSub metrics for the admin /eventsub dashboard. Measurements:
//   eventsub_shard       one heartbeat per bot shard every 30s (tags service, shard_id)
//   eventsub_event       one point per notification (tags service, event_type, handled, transport)
//   eventsub_connection  connect / lost / reconnect_attempt per shard
//   eventsub_revocation  one point per revoked subscription
// Points written before shards and transports had tags read as shard "0" and
// transport "unknown".

/** Latest heartbeat of one shard, all fields. */
export interface EventsubShardHeartbeatRow {
  service: string;
  shardId: string;
  time: string;
  connected: boolean;
  stateCode: number;
  /** Messages and notifications in the 30s before this heartbeat */
  messages: number;
  notifications: number;
  lastMessageAgeMs: number;
  reconnectAttempts: number;
  sessionAgeS: number | null;
  conduitMissing: boolean;
  sessionId: string | null;
}

/** A count in one time bucket for one series (shard, type, transport). */
export interface EventsubSeriesPoint {
  time: string;
  key: string;
  count: number;
}

const num = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const seriesPoint = (row: Record<string, string | undefined>): EventsubSeriesPoint => ({
  time: row._time ?? "",
  key: String(row.key ?? ""),
  count: Number(row._value ?? 0),
});

/** The latest heartbeat of every shard seen in the range, sorted by shard id. */
export async function queryEventsubShardHeartbeats(range = "1h", opts?: QueryOpts): Promise<EventsubShardHeartbeatRow[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_shard")
      |> group(columns: ["service", "shard_id", "_field"])
      |> last()
      // session_id is a string field and the rest are ints; Flux can't merge
      // tables whose _value types differ, so pivot everything as strings.
      |> map(fn: (r) => ({ r with _value: string(v: r._value) }))
      |> group()
      |> pivot(rowKey: ["service", "shard_id", "_time"], columnKey: ["_field"], valueColumn: "_value")
      |> yield(name: "eventsub_shard_heartbeats")
  `;
  const rows = await runFluxQuery(query, (row) => ({
    service: String(row.service ?? ""),
    shardId: String(row.shard_id ?? ""),
    time: row._time ?? "",
    connected: num(row.connected) === 1,
    stateCode: num(row.state_code) ?? 0,
    messages: num(row.messages) ?? 0,
    notifications: num(row.notifications) ?? 0,
    lastMessageAgeMs: num(row.last_message_age_ms) ?? 0,
    reconnectAttempts: num(row.reconnect_attempts) ?? 0,
    sessionAgeS: num(row.session_age_s),
    conduitMissing: num(row.conduit_missing) === 1,
    sessionId: row.session_id || null,
  }));
  // A pivot over fields from the same point can still split when a field is
  // missing; keep the newest row per shard.
  const latest = new Map<string, EventsubShardHeartbeatRow>();
  for (const row of rows) {
    const key = `${row.service}#${row.shardId}`;
    const prev = latest.get(key);
    if (!prev || row.time > prev.time) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => Number(a.shardId) - Number(b.shardId) || a.service.localeCompare(b.service));
}

/** Like EventsubSeriesPoint, but count may be null: callers pad the windows
 * a shard sent no heartbeat in with null, so an outage reads as a gap rather
 * than a quiet 0. The query itself only returns windows with heartbeats. */
export interface EventsubShardThroughputPoint {
  time: string;
  key: string;
  count: number | null;
}

/** Notifications per shard per window (sparklines, heatmap). key = shard id.
 * Only windows with at least one heartbeat come back: createEmpty would sum an
 * empty window to 0 and hide the outage. */
export function queryEventsubShardThroughput(range = "6h", window = "5m", opts?: QueryOpts): Promise<EventsubShardThroughputPoint[]> {
  assertValidFluxDuration(range, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_shard")
      |> filter(fn: (r) => r._field == "notifications")
      |> group(columns: ["shard_id"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> map(fn: (r) => ({ _time: r._time, _value: r._value, key: r.shard_id }))
      |> yield(name: "eventsub_shard_throughput")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    key: String(row.key ?? ""),
    count: num(row._value),
  }));
}

/** Events per type per window, both transports. key = event type. */
export function queryEventsubEventsByType(range = "24h", window = "15m", opts?: QueryOpts): Promise<EventsubSeriesPoint[]> {
  assertValidFluxDuration(range, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_event")
      |> filter(fn: (r) => r._field == "count")
      |> group(columns: ["event_type"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> map(fn: (r) => ({ _time: r._time, _value: r._value, key: r.event_type }))
      |> yield(name: "eventsub_events_by_type")
  `;
  return runFluxQuery(query, seriesPoint);
}

export interface EventsubTypeTotal {
  eventType: string;
  handled: number;
  unhandled: number;
}

/** Total events per type over the range, split by whether a handler ran. Sorted busiest first. */
export async function queryEventsubTypeTotals(range = "24h", opts?: QueryOpts): Promise<EventsubTypeTotal[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_event")
      |> filter(fn: (r) => r._field == "count")
      |> group(columns: ["event_type", "handled"])
      |> sum()
      |> yield(name: "eventsub_type_totals")
  `;
  const rows = await runFluxQuery(query, (row) => ({
    eventType: String(row.event_type ?? ""),
    handled: row.handled === "true",
    count: Number(row._value ?? 0),
  }));
  const byType = new Map<string, EventsubTypeTotal>();
  for (const row of rows) {
    const entry = byType.get(row.eventType) ?? { eventType: row.eventType, handled: 0, unhandled: 0 };
    if (row.handled) entry.handled += row.count;
    else entry.unhandled += row.count;
    byType.set(row.eventType, entry);
  }
  return [...byType.values()].sort((a, b) => b.handled + b.unhandled - (a.handled + a.unhandled));
}

/** Events per transport per window. key = "webhook" | "websocket" | "unknown". */
export function queryEventsubTransportSeries(range = "24h", window = "15m", opts?: QueryOpts): Promise<EventsubSeriesPoint[]> {
  assertValidFluxDuration(range, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_event")
      |> filter(fn: (r) => r._field == "count")
      |> map(fn: (r) => ({ r with transport: if exists r.transport then r.transport else "unknown" }))
      |> group(columns: ["transport"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> map(fn: (r) => ({ _time: r._time, _value: r._value, key: r.transport }))
      |> yield(name: "eventsub_transport_series")
  `;
  return runFluxQuery(query, seriesPoint);
}

export interface EventsubConnectionCount {
  service: string;
  shardId: string;
  event: "connected" | "lost" | "reconnect_attempt" | string;
  count: number;
}

/** Connection events per shard over the range (reconnect and outage counts). */
export function queryEventsubConnectionCounts(range = "24h", opts?: QueryOpts): Promise<EventsubConnectionCount[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_connection")
      |> filter(fn: (r) => r._field == "count")
      |> map(fn: (r) => ({ r with shard_id: if exists r.shard_id then r.shard_id else "0" }))
      |> group(columns: ["service", "shard_id", "event"])
      |> sum()
      |> yield(name: "eventsub_connection_counts")
  `;
  return runFluxQuery(query, (row) => ({
    service: String(row.service ?? ""),
    shardId: String(row.shard_id ?? "0"),
    event: String(row.event ?? ""),
    count: Number(row._value ?? 0),
  }));
}

export interface EventsubRevocationCount {
  eventType: string;
  transport: string;
  count: number;
}

/** Revoked subscriptions per type and transport over the range. */
export function queryEventsubRevocations(range = "24h", opts?: QueryOpts): Promise<EventsubRevocationCount[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_revocation")
      |> filter(fn: (r) => r._field == "count")
      |> map(fn: (r) => ({ r with transport: if exists r.transport then r.transport else "unknown" }))
      |> group(columns: ["event_type", "transport"])
      |> sum()
      |> yield(name: "eventsub_revocations")
  `;
  return runFluxQuery(query, (row) => ({
    eventType: String(row.event_type ?? ""),
    transport: String(row.transport ?? "unknown"),
    count: Number(row._value ?? 0),
  }));
}
