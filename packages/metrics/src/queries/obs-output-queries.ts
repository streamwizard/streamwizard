import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { fluxFrom } from "../buckets";

// Stream output stats per OBS instance — written by obs-instance-manager's
// src/services/obs/output-stats.ts from the streamwizard-obs-stats plugin's
// `OutputStats` event: one `obs_output` point per instance every 10s, tagged
// node_id, instance_id and user_id. The streaming fields only exist while a
// stream output is active.

export interface ObsOutputPoint {
  time: string;
  instanceId: string;
  value: number;
}

/** Gauges: a reading at the moment of the write (or the window's worst, *_max / *_min). */
export type ObsOutputGauge =
  | "kbps"
  | "kbps_min"
  | "congestion"
  | "congestion_max"
  | "drop_pct"
  | "encode_lag_pct"
  | "render_active_fps"
  | "render_target_fps"
  | "render_lag_pct"
  | "reconnects";

/** Cumulative counters since the stream (or OBS) started. */
export type ObsOutputCounter = "dropped_frames" | "encode_skipped_frames" | "render_lagged_frames";

export type ObsOutputAggregate = "mean" | "min" | "max" | "sum";

// instanceId lands inside the Flux source: restrict it to uuid-safe characters
// so it can't break out of the string literal.
function assertInstanceId(instanceId: string): void {
  if (!/^[a-zA-Z0-9-]+$/.test(instanceId)) throw new Error("Invalid instance id");
}

function source(instanceId: string, fluxRange: string, field: string): string {
  // Grouped to one series per field, so a move to another node (a new node_id
  // tag) doesn't split the line into two tables with the same timestamps.
  return `
    ${fluxFrom("obs_output", `-${fluxRange}`)}
      |> filter(fn: (r) => r._measurement == "obs_output")
      |> filter(fn: (r) => r.instance_id == "${instanceId}")
      |> filter(fn: (r) => r._field == "${field}")
      |> group(columns: ["instance_id", "_field"])
      |> sort(columns: ["_time"])`;
}

function toPoint(row: Record<string, string>): ObsOutputPoint {
  return { time: row._time ?? "", instanceId: row.instance_id ?? "unknown", value: Number(row._value) };
}

/** A gauge per window, aggregated with `fn` (mean for the line, max/min for the worst case). */
export function queryObsOutputField(
  instanceId: string,
  field: ObsOutputGauge,
  fn: ObsOutputAggregate,
  fluxRange = "24h",
  window = "5m",
): Promise<ObsOutputPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  assertInstanceId(instanceId);
  const query = `${source(instanceId, fluxRange, field)}
      |> toFloat()
      |> aggregateWindow(every: ${window}, fn: ${fn}, createEmpty: false)
      |> yield(name: "${field}_${fn}")
  `;
  return runFluxQuery(query, toPoint);
}

/**
 * How much a cumulative counter grew per window. The plugin's counters restart
 * at zero with every new stream, so a drop is read as a restart: initialZero
 * counts the new value from zero instead of discarding it.
 */
export function queryObsOutputDelta(
  instanceId: string,
  field: ObsOutputCounter,
  fluxRange = "24h",
  window = "5m",
): Promise<ObsOutputPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  assertInstanceId(instanceId);
  const query = `${source(instanceId, fluxRange, field)}
      |> difference(nonNegative: true, initialZero: true)
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "${field}_delta")
  `;
  return runFluxQuery(query, toPoint);
}

export interface ObsOutputLatest {
  time: string;
  streamingActive: boolean;
  reconnecting: boolean;
  recordingActive: boolean;
  kbps: number | null;
  /** Encoder target bitrate, to read kbps against. */
  targetKbps: number | null;
  /** 0..1, OBS's own congestion estimate. */
  congestion: number | null;
  /** Percent of frames dropped by the network since the stream started. */
  dropPct: number | null;
  /** Percent of frames the encoder skipped since the stream started. */
  encodeLagPct: number | null;
  /** Percent of frames OBS rendered late since it started. */
  renderLagPct: number | null;
  renderFps: number | null;
  targetFps: number | null;
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// The client hands back typed values (booleans as booleans), despite the row type.
const bool = (v: unknown): boolean => v === true || v === "true";

/**
 * The newest point for one instance, or null when it wrote none in the last
 * two minutes (OBS closed, or the node runs an OIM without OutputStats).
 */
export async function queryObsOutputLatest(instanceId: string): Promise<ObsOutputLatest | null> {
  assertInstanceId(instanceId);
  // pivot() dissolves _value into one column per field, so last() must be told
  // to check _time (see queryObsNodeSnapshot).
  const query = `
    ${fluxFrom("obs_output", "-2m")}
      |> filter(fn: (r) => r._measurement == "obs_output")
      |> filter(fn: (r) => r.instance_id == "${instanceId}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["instance_id"])
      |> last(column: "_time")
      |> yield(name: "obs_output_latest")
  `;
  const rows = await runFluxQuery(query, (row): ObsOutputLatest => {
    const r = row as Record<string, unknown>;
    return {
      time: String(r._time ?? ""),
      streamingActive: bool(r.streaming_active),
      reconnecting: bool(r.reconnecting),
      recordingActive: bool(r.recording_active),
      kbps: num(r.kbps),
      targetKbps: num(r.video_bitrate_target_kbps),
      congestion: num(r.congestion),
      dropPct: num(r.drop_pct),
      encodeLagPct: num(r.encode_lag_pct),
      renderLagPct: num(r.render_lag_pct),
      renderFps: num(r.render_active_fps),
      targetFps: num(r.render_target_fps),
    };
  });
  return rows[0] ?? null;
}

export interface ObsOutputWindowStats {
  instanceId: string;
  nodeId: string;
  /** The streamer: obs_output is tagged with the instance owner. */
  userId: string;
  /** Frames the network output sent and dropped within the lookback. */
  totalFrames: number;
  droppedFrames: number;
  /** Mean of OBS's congestion estimate (0..1) over the lookback. */
  congestion: number | null;
  /** Times the output started reconnecting within the lookback. */
  reconnects: number;
}

/**
 * Stream output per instance over the last `lookback`, for the stream.* alert
 * rules: frame counters as deltas (so a drop rate covers just this window,
 * not the whole stream), congestion as a mean and reconnects as a count.
 * Instances that weren't streaming have no counter fields and come back with
 * zero frames.
 */
export async function queryObsOutputWindowStats(lookback: string): Promise<ObsOutputWindowStats[]> {
  assertValidFluxDuration(lookback, "lookback");
  const query = `
    data = ${fluxFrom("obs_output", `-${lookback}`)}
      |> filter(fn: (r) => r._measurement == "obs_output")
      |> filter(fn: (r) =>
        r._field == "dropped_frames" or r._field == "total_frames" or r._field == "congestion" or r._field == "reconnects")
      |> group(columns: ["instance_id", "user_id", "node_id", "_field"])
      |> sort(columns: ["_time"])
      |> toFloat()

    counters = data
      |> filter(fn: (r) => r._field == "dropped_frames" or r._field == "total_frames")
      |> difference(nonNegative: true, initialZero: true)
      |> sum()
    congestion = data |> filter(fn: (r) => r._field == "congestion") |> mean()
    reconnects = data |> filter(fn: (r) => r._field == "reconnects") |> sum()

    union(tables: [counters, congestion, reconnects])
      |> group(columns: ["instance_id", "user_id", "node_id"])
      |> pivot(rowKey: ["instance_id"], columnKey: ["_field"], valueColumn: "_value")
      |> yield(name: "obs_output_window")
  `;
  return runFluxQuery(query, (row) => {
    const r = row as Record<string, unknown>;
    return {
      instanceId: String(r.instance_id ?? ""),
      nodeId: String(r.node_id ?? ""),
      userId: String(r.user_id ?? ""),
      totalFrames: num(r.total_frames) ?? 0,
      droppedFrames: num(r.dropped_frames) ?? 0,
      congestion: num(r.congestion),
      reconnects: num(r.reconnects) ?? 0,
    };
  });
}
