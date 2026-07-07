import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// Ingest node host metrics (host_system, written by ingest-control) and
// per-signal ("camera") ingest stream stats (ingest_stream, written by
// ingest-control per session) — see packages/metrics/src/system-metrics.ts
// and ingest-metrics.ts in the ingest-server repo for the write side.

export interface HostSystemPoint {
  time: string;
  nodeId: string;
  value: number;
}

async function queryHostSystemField(
  field: string,
  fluxRange: string,
  window: string,
  opts?: QueryOpts,
): Promise<HostSystemPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "host_system")
      |> filter(fn: (r) => r._field == "${field}")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "${field}")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    nodeId: row.node_id ?? "unknown",
    value: Number(row._value),
  }));
}

export function queryHostCpu(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("cpu_pct", fluxRange, window, opts);
}

export function queryHostMemUsed(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("mem_used_mb", fluxRange, window, opts);
}

export function queryHostRxBandwidth(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("rx_bytes_per_sec", fluxRange, window, opts);
}

export function queryHostTxBandwidth(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("tx_bytes_per_sec", fluxRange, window, opts);
}

export interface ActiveIngestSignal {
  userId: string;
  streamKeyId: string;
  label: string;
  sessionId: string;
  protocol: string;
  kbps: number;
  lastSeen: string;
}

// One row per currently-active incoming signal (a user's stream key/"camera"),
// using the most recent sample in the window as a liveness + throughput
// snapshot. A user with two simultaneous cameras gets two rows here, one per
// stream_key_id.
export async function queryActiveIngestSignals(recentWindow = "2m", opts?: QueryOpts): Promise<ActiveIngestSignal[]> {
  assertValidFluxDuration(recentWindow, "recentWindow");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${recentWindow})
      |> filter(fn: (r) => r._measurement == "ingest_stream")
      |> filter(fn: (r) => r._field == "kbps" or r._field == "label")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["stream_key_id"])
      // pivot drops the _value column, so bare last() (which targets _value)
      // errors the moment any signal is present — target kbps explicitly.
      |> last(column: "kbps")
      |> yield(name: "active_signals")
  `;
  return runFluxQuery(query, (row) => ({
    userId: row.user_id ?? "unknown",
    streamKeyId: row.stream_key_id ?? "unknown",
    label: String(row.label ?? "unlabeled"),
    sessionId: row.session_id ?? "unknown",
    protocol: row.protocol ?? "unknown",
    kbps: Number(row.kbps ?? 0),
    lastSeen: row._time ?? "",
  }));
}
