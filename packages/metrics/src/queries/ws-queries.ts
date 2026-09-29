import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { fluxFrom } from "../buckets";

export interface WsConnectionPoint {
  time: string;
  role: string;
  event: string;
  count: number;
}

export interface WsMessagePoint {
  time: string;
  role: string;
  messageType: string;
  count: number;
}

export interface WsAuthFailurePoint {
  time: string;
  role: string;
  reason: string;
  count: number;
}

export interface WsMessageDropPoint {
  time: string;
  role: string;
  reason: string;
  count: number;
}

export interface WsConnectionDurationPoint {
  time: string;
  role: string;
  avgMs: number;
}

export interface WsRoomEventPoint {
  time: string;
  event: string;
  count: number;
}

export interface WsTopMessageTypePoint {
  messageType: string;
  count: number;
}

export async function queryWsConnections(fluxRange = "24h", window = "1h"): Promise<WsConnectionPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    ${fluxFrom("ws_connection", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_connection")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "ws_connections")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    role: row.role ?? "unknown",
    event: row.event ?? "unknown",
    count: Number(row._value),
  }));
}

export async function queryWsMessages(fluxRange = "24h", window = "1h"): Promise<WsMessagePoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    ${fluxFrom("ws_message", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_message")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "ws_messages")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    role: row.role ?? "unknown",
    messageType: row.message_type ?? "unknown",
    count: Number(row._value),
  }));
}

export async function queryWsAuthFailures(fluxRange = "24h", window = "1h"): Promise<WsAuthFailurePoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    ${fluxFrom("ws_auth_failure", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_auth_failure")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "ws_auth_failures")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    role: row.role ?? "unknown",
    reason: row.reason ?? "unknown",
    count: Number(row._value),
  }));
}

export async function queryWsDroppedMessages(fluxRange = "24h", window = "1h"): Promise<WsMessageDropPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    ${fluxFrom("ws_message_drop", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_message_drop")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "ws_drops")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    role: row.role ?? "unknown",
    reason: row.reason ?? "unknown",
    count: Number(row._value),
  }));
}

export async function queryWsConnectionDuration(fluxRange = "24h", window = "1h"): Promise<WsConnectionDurationPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    ${fluxFrom("ws_connection", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_connection")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> filter(fn: (r) => r.event == "close")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "ws_duration")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    role: row.role ?? "unknown",
    avgMs: Number(row._value),
  }));
}

export async function queryWsRoomEvents(fluxRange = "24h", window = "1h"): Promise<WsRoomEventPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    ${fluxFrom("ws_room", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_room")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "ws_rooms")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    event: row.event ?? "unknown",
    count: Number(row._value),
  }));
}

export async function queryWsActiveConnectionsEstimate(): Promise<{ role: string; active: number }[]> {

  // Compute opens and closes separately, then subtract in code — simpler than Flux join
  const opensQuery = `
    ${fluxFrom("ws_connection", `0`)}
      |> filter(fn: (r) => r._measurement == "ws_connection" and r._field == "count" and r.event == "open")
      |> group(columns: ["role"])
      |> sum()
      |> yield(name: "opens")
  `;
  const closesQuery = `
    ${fluxFrom("ws_connection", `0`)}
      |> filter(fn: (r) => r._measurement == "ws_connection" and r._field == "count" and r.event == "close")
      |> group(columns: ["role"])
      |> sum()
      |> yield(name: "closes")
  `;

  const [opens, closes] = await Promise.all([
    runFluxQuery(opensQuery, (row) => ({ role: row.role ?? "unknown", count: Number(row._value) })),
    runFluxQuery(closesQuery, (row) => ({ role: row.role ?? "unknown", count: Number(row._value) })),
  ]);

  const closeMap = new Map(closes.map((c) => [c.role, c.count]));
  return opens.map((o) => ({
    role: o.role,
    active: Math.max(0, o.count - (closeMap.get(o.role) ?? 0)),
  }));
}

export async function queryWsTopMessageTypes(fluxRange = "24h", limit = 15): Promise<WsTopMessageTypePoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  const query = `
    ${fluxFrom("ws_message", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "ws_message")
      |> filter(fn: (r) => r._field == "count")
      |> group(columns: ["message_type"])
      |> sum()
      |> sort(columns: ["_value"], desc: true)
      |> limit(n: ${Math.max(1, Math.floor(limit))})
      |> yield(name: "top_types")
  `;
  return runFluxQuery(query, (row) => ({
    messageType: row.message_type ?? "unknown",
    count: Number(row._value),
  }));
}
