import { assertValidFluxDuration } from "../query-client";
import { fluxFrom } from "../buckets";

// Flux building blocks shared by the readers of the webserver bucket
// (webserver-queries.ts, traefik-queries.ts). Not exported from the package:
// index.ts leaves this file out on purpose.

/** One chart point. `nodeId` is the series label so NodeMetricChart takes it as is. */
export interface WebserverMetricPoint {
  time: string;
  nodeId: string;
  value: number;
}

export type Row = Record<string, string>;

const fieldIn = (fields: readonly string[]) => `(${fields.map((f) => `r._field == "${f}"`).join(" or ")})`;

/** `(r._measurement == m and (r._field == …))`, for picking fields per measurement. */
export const pick = (measurement: string, fields: readonly string[]) => `(r._measurement == "${measurement}" and ${fieldIn(fields)})`;

export const any = (predicates: string[]) => predicates.join(" or ");

// Every measurement of the Dokploy server lives in the one webserver bucket.
export const source = (range: string) => fluxFrom("server_cpu", `-${assertValidFluxDuration(range, "range")}`);

export const num = (v: string | undefined): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const TRAEFIK_REQUESTS = "traefik_service_requests_total";
export const TRAEFIK_DURATION_SUM = "traefik_service_request_duration_seconds_sum";
export const TRAEFIK_DURATION_COUNT = "traefik_service_request_duration_seconds_count";

/**
 * Latest value per series: last() for gauges, the mean rate over the range
 * for counters. No pivot: rows come back per field and are grouped in TS.
 */
export function latestQuery(opts: { range: string; base?: string; gauges?: string[]; rates?: string[] }): string {
  const branches: string[] = [];
  if (opts.gauges?.length) {
    branches.push(`gauges = data
  |> filter(fn: (r) => ${any(opts.gauges)})
  |> last()`);
  }
  if (opts.rates?.length) {
    // mean() drops _time; keep the window's stop as a stand-in.
    branches.push(`rates = data
  |> filter(fn: (r) => ${any(opts.rates)})
  |> derivative(unit: 1s, nonNegative: true)
  |> mean()
  |> duplicate(column: "_stop", as: "_time")`);
  }
  const names = branches.map((b) => b.slice(0, b.indexOf(" ")));
  return `
data = ${source(opts.range)}${opts.base ? `\n  |> filter(fn: (r) => ${opts.base})` : ""}
${branches.join("\n")}
${names.length === 1 ? names[0] : `union(tables: [${names.join(", ")}])`}
  |> yield(name: "latest")`;
}

/**
 * A page's worth of series in one round trip: gauges averaged per window,
 * counters turned into a per-second rate first, deltas into the increase
 * per window.
 */
export function seriesQuery(opts: { range: string; window: string; base?: string; gauges?: string[]; rates?: string[]; deltas?: string[] }): string {
  const window = assertValidFluxDuration(opts.window, "window");
  const branches: string[] = [];
  if (opts.gauges?.length) {
    branches.push(`gauges = data
  |> filter(fn: (r) => ${any(opts.gauges)})
  |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)`);
  }
  if (opts.rates?.length) {
    branches.push(`rates = data
  |> filter(fn: (r) => ${any(opts.rates)})
  |> derivative(unit: 1s, nonNegative: true)
  |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)`);
  }
  if (opts.deltas?.length) {
    branches.push(`deltas = data
  |> filter(fn: (r) => ${any(opts.deltas)})
  |> difference(nonNegative: true)
  |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)`);
  }
  const names = branches.map((b) => b.slice(0, b.indexOf(" ")));
  return `
data = ${source(opts.range)}${opts.base ? `\n  |> filter(fn: (r) => ${opts.base})` : ""}
${branches.join("\n")}
${names.length === 1 ? names[0] : `union(tables: [${names.join(", ")}])`}
  |> yield(name: "series")`;
}

/** Sums rows that share a time and label into one chart point each. */
export function sumPoints(rows: Row[], label: (row: Row) => string | null): WebserverMetricPoint[] {
  const totals = new Map<string, WebserverMetricPoint>();
  for (const row of rows) {
    const nodeId = label(row);
    const value = num(row._value);
    if (nodeId === null || value === null || !row._time) continue;
    const id = `${row._time}|${nodeId}`;
    const point = totals.get(id);
    if (point) point.value += value;
    else totals.set(id, { time: row._time, nodeId, value });
  }
  return [...totals.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** Per time: the sum of the `isA` rows divided by the sum of the `isB` rows. */
export function ratioPoints(rows: Row[], nodeId: string, isA: (row: Row) => boolean, isB: (row: Row) => boolean, scale = 1): WebserverMetricPoint[] {
  const a = sumPoints(rows, (row) => (isA(row) ? nodeId : null));
  const b = new Map(sumPoints(rows, (row) => (isB(row) ? nodeId : null)).map((p) => [p.time, p.value]));
  return a.flatMap((p) => {
    const divisor = b.get(p.time);
    return divisor ? [{ time: p.time, nodeId, value: (p.value / divisor) * scale }] : [];
  });
}
