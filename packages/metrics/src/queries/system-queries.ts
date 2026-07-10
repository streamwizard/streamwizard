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

export function queryHostDiskUsed(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("disk_used_pct", fluxRange, window, opts);
}

export function queryHostCpuSteal(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("cpu_steal_pct", fluxRange, window, opts);
}

export function queryHostLoadAvg(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("load_avg_1", fluxRange, window, opts);
}

export function queryHostTailscaleRx(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("tailscale_rx_bytes_per_sec", fluxRange, window, opts);
}

export function queryHostTailscaleTx(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<HostSystemPoint[]> {
  return queryHostSystemField("tailscale_tx_bytes_per_sec", fluxRange, window, opts);
}

export interface HostNodeSnapshot {
  nodeId: string;
  cpuPct: number;
  ramUsedMb: number;
  ramTotalMb: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  /** Populated once the node runs the newer sampler; null on older nodes. */
  cpuStealPct: number | null;
  loadAvg1: number | null;
  diskUsedPct: number | null;
  time: string;
}

// Latest per-node reading across host_system fields — the "fleet at a glance"
// row for each ingest box, mirroring queryObsNodeSnapshot.
export async function queryHostSnapshot(opts?: QueryOpts): Promise<HostNodeSnapshot[]> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -10m)
      |> filter(fn: (r) => r._measurement == "host_system")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["node_id"])
      |> last(column: "cpu_pct")
      |> yield(name: "host_snapshot")
  `;
  const toNum = (v: unknown): number | null => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return runFluxQuery(query, (row) => ({
    nodeId: row.node_id ?? "unknown",
    cpuPct: Number(row.cpu_pct ?? 0),
    ramUsedMb: Number(row.mem_used_mb ?? 0),
    ramTotalMb: Number(row.mem_total_mb ?? 0),
    rxBytesPerSec: Number(row.rx_bytes_per_sec ?? 0),
    txBytesPerSec: Number(row.tx_bytes_per_sec ?? 0),
    cpuStealPct: toNum(row.cpu_steal_pct),
    loadAvg1: toNum(row.load_avg_1),
    diskUsedPct: toNum(row.disk_used_pct),
    time: row._time ?? "",
  }));
}

export interface ActiveIngestSignal {
  userId: string;
  streamKeyId: string;
  label: string;
  sessionId: string;
  protocol: string;
  kbps: number;
  lastSeen: string;
  /** SRT link quality for the latest sample; undefined for protocols/samples
   *  that don't report it (e.g. plain RTMP). */
  rttMs?: number;
  lossPct?: number;
  retransPct?: number;
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
      |> filter(fn: (r) => r._field == "kbps" or r._field == "label"
          or r._field == "rtt_ms" or r._field == "loss_pct" or r._field == "retrans_pct")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["stream_key_id"])
      // pivot drops the _value column, so bare last() (which targets _value)
      // errors the moment any signal is present — target kbps explicitly.
      |> last(column: "kbps")
      |> yield(name: "active_signals")
  `;
  const toNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return runFluxQuery(query, (row) => ({
    userId: row.user_id ?? "unknown",
    streamKeyId: row.stream_key_id ?? "unknown",
    label: String(row.label ?? "unlabeled"),
    sessionId: row.session_id ?? "unknown",
    protocol: row.protocol ?? "unknown",
    kbps: Number(row.kbps ?? 0),
    lastSeen: row._time ?? "",
    rttMs: toNum(row.rtt_ms),
    lossPct: toNum(row.loss_pct),
    retransPct: toNum(row.retrans_pct),
  }));
}
