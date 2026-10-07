import { assertValidFluxDuration, runFluxQuery } from "../query-client";
import {
  emptyRates,
  isTraefikScope,
  speedBandLabels,
  speedBands,
  statusClass,
  type TraefikAppStats,
  type TraefikScope,
  type TraefikStatusCount,
} from "../traefik-model";
import { appKey } from "./webserver-queries";
import {
  TRAEFIK_DURATION_COUNT,
  TRAEFIK_DURATION_SUM,
  TRAEFIK_REQUESTS,
  latestQuery,
  num,
  pick,
  source,
  sumPoints,
  type Row,
  type WebserverMetricPoint,
} from "./webserver-flux";

// Traefik's own numbers for web-admin's /traefik page: measurement "traefik"
// in the webserver bucket (prod org only: check orgHasBucket() first). Telegraf
// scrapes Traefik's Prometheus endpoint every 30 s.
//   per service  traefik_service_requests_total, the duration histogram
//                (_bucket with an le tag, _sum, _count) and the byte counters,
//                tagged service, app, env, code, method, protocol
//   whole proxy  traefik_entrypoint_requests_total and
//                traefik_open_connections, tagged entrypoint: no app, no env
// Everything but open_connections is a counter since Traefik started:
// derivative() first, and a Traefik restart reads low for one window.
//
// One series per service, code, method and protocol adds up fast, so the
// queries here sum across series inside Flux and hand back a few rows.

const TRAEFIK_DURATION_BUCKET = "traefik_service_request_duration_seconds_bucket";
const TRAEFIK_BYTES_IN = "traefik_service_requests_bytes_total";
const TRAEFIK_BYTES_OUT = "traefik_service_responses_bytes_total";
const TRAEFIK_OPEN_CONNECTIONS = "traefik_open_connections";
const TRAEFIK_ENTRYPOINT_REQUESTS = "traefik_entrypoint_requests_total";

const REQUESTS = pick("traefik", [TRAEFIK_REQUESTS]);
const BYTES = pick("traefik", [TRAEFIK_BYTES_IN, TRAEFIK_BYTES_OUT]);
const DURATION = pick("traefik", [TRAEFIK_DURATION_SUM, TRAEFIK_DURATION_COUNT]);
// A WebSocket or SSE connection stays open for minutes and lands in the
// slowest step when it closes: the speed bands are about HTTP only.
const HTTP_HISTOGRAM = `(${pick("traefik", [TRAEFIK_DURATION_BUCKET])} and r.protocol == "http")`;

const HAS_APP = "exists r.app and exists r.env";

export function assertTraefikScope(value: string): TraefikScope {
  if (!isTraefikScope(value)) throw new Error("Invalid env");
  return value;
}

const inScope = (scope: string) => {
  const checked = assertTraefikScope(scope);
  return checked === "all" ? HAS_APP : `r.env == "${checked}"`;
};

// ============================================================================
// Right now: one row per app
// ============================================================================

export function buildTraefikAppsQuery(range = "5m"): string {
  return `
${source(range)}
  |> filter(fn: (r) => ${REQUESTS} or ${BYTES} or ${DURATION} or ${HTTP_HISTOGRAM})
  |> filter(fn: (r) => ${HAS_APP})
  |> derivative(unit: 1s, nonNegative: true)
  |> mean()
  |> group(columns: ["app", "env", "_field", "code", "le"])
  |> sum()
  |> yield(name: "apps")`;
}

/** Request, error, speed and byte rates of every app Traefik routes to, all environments. */
export async function queryTraefikApps(range = "5m"): Promise<TraefikAppStats[]> {
  const rows = await runFluxQuery(buildTraefikAppsQuery(range), (row) => row);
  const apps = new Map<string, TraefikAppStats>();
  for (const row of rows) {
    const value = num(row._value);
    if (!row.app || !row.env || value === null) continue;
    const key = appKey(row.env, row.app);
    let app = apps.get(key);
    if (!app) {
      app = { key, app: row.app, env: row.env, ...emptyRates() };
      apps.set(key, app);
    }
    switch (row._field) {
      case TRAEFIK_REQUESTS: {
        app.requestsPerSec += value;
        const status = statusClass(row.code);
        if (status === "4xx") app.clientErrorsPerSec += value;
        if (status === "5xx") app.serverErrorsPerSec += value;
        break;
      }
      case TRAEFIK_BYTES_IN:
        app.bytesInPerSec += value;
        break;
      case TRAEFIK_BYTES_OUT:
        app.bytesOutPerSec += value;
        break;
      case TRAEFIK_DURATION_SUM:
        app.durationPerSec += value;
        break;
      case TRAEFIK_DURATION_COUNT:
        app.timedPerSec += value;
        break;
      case TRAEFIK_DURATION_BUCKET:
        if (row.le) app.httpWithin[row.le] = (app.httpWithin[row.le] ?? 0) + value;
        break;
    }
  }
  return [...apps.values()];
}

export interface TraefikSparkline {
  key: string;
  /** Requests per second, one value per window, oldest first. */
  requests: number[];
}

export function buildTraefikSparklinesQuery(range = "1h", window = "5m"): string {
  return `
${source(range)}
  |> filter(fn: (r) => ${REQUESTS})
  |> filter(fn: (r) => ${HAS_APP})
  |> derivative(unit: 1s, nonNegative: true)
  |> aggregateWindow(every: ${assertValidFluxDuration(window, "window")}, fn: mean, createEmpty: false)
  |> group(columns: ["_time", "app", "env"])
  |> sum()
  |> yield(name: "sparklines")`;
}

/** Small per-app request trend lines for the /traefik table, every app in one query. */
export async function queryTraefikSparklines(range = "1h", window = "5m"): Promise<TraefikSparkline[]> {
  const rows = await runFluxQuery(buildTraefikSparklinesQuery(range, window), (row) => row);
  const apps = new Map<string, { time: string; value: number }[]>();
  for (const row of rows) {
    const value = num(row._value);
    if (!row.app || !row.env || !row._time || value === null) continue;
    const key = appKey(row.env, row.app);
    const points = apps.get(key) ?? [];
    points.push({ time: row._time, value });
    apps.set(key, points);
  }
  return [...apps.entries()].map(([key, points]) => ({
    key,
    requests: points.sort((a, b) => a.time.localeCompare(b.time)).map((p) => p.value),
  }));
}

// ============================================================================
// Over time: the charts of one scope
// ============================================================================

/** Chart series of one scope, keyed like the charts' dataKey. */
export interface TraefikHistory {
  /** "5xx" and "4xx": share of all answers, 0 to 100. */
  errorShare: WebserverMetricPoint[];
  /** One series per speed band: share of the HTTP requests, 0 to 100. */
  speedBands: WebserverMetricPoint[];
  /** The speed bands' names, fastest first. */
  speedBandOrder: string[];
  /** Requests per second per protocol: "HTTP", "WebSocket", "SSE". */
  requests: WebserverMetricPoint[];
  /** "In" and "Out", bytes/s. */
  data: WebserverMetricPoint[];
}

export const emptyTraefikHistory = (): TraefikHistory => ({ errorShare: [], speedBands: [], speedBandOrder: [], requests: [], data: [] });

export function buildTraefikHistoryQuery(scope: string, range = "24h", window = "1h"): string {
  return `
data = ${source(range)}
  |> filter(fn: (r) => ${REQUESTS} or ${BYTES} or ${HTTP_HISTOGRAM})
  |> filter(fn: (r) => ${inScope(scope)})
  |> derivative(unit: 1s, nonNegative: true)
  |> aggregateWindow(every: ${assertValidFluxDuration(window, "window")}, fn: mean, createEmpty: false)
requests = data
  |> filter(fn: (r) => r._field == "${TRAEFIK_REQUESTS}")
  |> group(columns: ["_time", "_field", "code", "protocol"])
  |> sum()
bands = data
  |> filter(fn: (r) => r._field == "${TRAEFIK_DURATION_BUCKET}")
  |> group(columns: ["_time", "_field", "le"])
  |> sum()
bytes = data
  |> filter(fn: (r) => r._field == "${TRAEFIK_BYTES_IN}" or r._field == "${TRAEFIK_BYTES_OUT}")
  |> group(columns: ["_time", "_field"])
  |> sum()
union(tables: [requests, bands, bytes])
  |> yield(name: "series")`;
}

const PROTOCOL_LABEL: Record<string, string> = { http: "HTTP", websocket: "WebSocket", sse: "SSE" };

/** The error classes the share chart draws, worst first. */
export const TRAEFIK_ERROR_CLASSES = ["5xx", "4xx"] as const;

/** Per window: the 5xx and the 4xx answers as a share of all answers. */
function errorSharePoints(requests: Row[]): WebserverMetricPoint[] {
  const all = sumPoints(requests, () => "all");
  const errors = new Map(
    sumPoints(requests, (row) => {
      const status = statusClass(row.code);
      return status === "4xx" || status === "5xx" ? status : null;
    }).map((p) => [`${p.time}|${p.nodeId}`, p.value]),
  );
  return all.flatMap((total) =>
    // A window without requests has no share: the line breaks there.
    total.value > 0 ? TRAEFIK_ERROR_CLASSES.map((status) => ({ time: total.time, nodeId: status, value: ((errors.get(`${total.time}|${status}`) ?? 0) / total.value) * 100 })) : [],
  );
}

/** Per window: the share of the HTTP requests in each speed band. */
function speedBandPoints(histogram: Row[]): WebserverMetricPoint[] {
  const windows = new Map<string, Record<string, number>>();
  for (const row of histogram) {
    const value = num(row._value);
    if (!row._time || !row.le || value === null) continue;
    const within = windows.get(row._time) ?? {};
    within[row.le] = (within[row.le] ?? 0) + value;
    windows.set(row._time, within);
  }
  return [...windows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([time, within]) => speedBands(within).map((band) => ({ time, nodeId: band.label, value: band.share })));
}

/** Every chart of one environment (or of all apps) on the /traefik page. */
export async function queryTraefikHistory(scope: string, range = "24h", window = "1h"): Promise<TraefikHistory> {
  const rows = await runFluxQuery(buildTraefikHistoryQuery(scope, range, window), (row) => row);
  const requests = rows.filter((row) => row._field === TRAEFIK_REQUESTS);
  const histogram = rows.filter((row) => row._field === TRAEFIK_DURATION_BUCKET);
  return {
    errorShare: errorSharePoints(requests),
    speedBands: speedBandPoints(histogram),
    speedBandOrder: speedBandLabels([...new Set(histogram.flatMap((row) => (row.le ? [row.le] : [])))]),
    requests: sumPoints(requests, (row) => (row.protocol ? (PROTOCOL_LABEL[row.protocol] ?? row.protocol) : null)),
    data: sumPoints(rows, (row) => (row._field === TRAEFIK_BYTES_IN ? "In" : row._field === TRAEFIK_BYTES_OUT ? "Out" : null)),
  };
}

// ============================================================================
// Status codes: who answered with what
// ============================================================================

export function buildTraefikStatusCountsQuery(scope: string, range = "24h"): string {
  return `
${source(range)}
  |> filter(fn: (r) => ${REQUESTS})
  |> filter(fn: (r) => ${inScope(scope)})
  |> difference(nonNegative: true)
  |> group(columns: ["app", "env", "code"])
  |> sum()
  |> yield(name: "status")`;
}

/**
 * Answers per app and status code in the range. A code an app sends for the
 * first time loses its first hits: the counter has no earlier point to
 * compare with.
 */
export async function queryTraefikStatusCounts(scope: string, range = "24h"): Promise<TraefikStatusCount[]> {
  const rows = await runFluxQuery(buildTraefikStatusCountsQuery(scope, range), (row) => row);
  return rows.flatMap((row) => {
    const count = num(row._value);
    if (!row.app || !row.env || !row.code || count === null) return [];
    return [{ key: appKey(row.env, row.app), app: row.app, env: row.env, code: String(row.code), count }];
  });
}

// ============================================================================
// The whole proxy: entrypoints, whatever app the request was for
// ============================================================================

/** Chart series of Traefik as a whole. */
export interface TraefikProxyHistory {
  /** Open connections per entrypoint. */
  connections: WebserverMetricPoint[];
  /** Requests per second per entrypoint, also the ones no router matched. */
  entrypoints: WebserverMetricPoint[];
}

export const emptyTraefikProxyHistory = (): TraefikProxyHistory => ({ connections: [], entrypoints: [] });

export function buildTraefikProxyHistoryQuery(range = "24h", window = "1h"): string {
  const every = assertValidFluxDuration(window, "window");
  // The field filter sits on `data` itself. Left to the two branches, InfluxDB
  // reads the whole bucket for the range first: 11 s against 0.5 s on prod.
  return `
data = ${source(range)}
  |> filter(fn: (r) => ${pick("traefik", [TRAEFIK_OPEN_CONNECTIONS, TRAEFIK_ENTRYPOINT_REQUESTS])})
connections = data
  |> filter(fn: (r) => r._field == "${TRAEFIK_OPEN_CONNECTIONS}")
  |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)
  |> group(columns: ["_time", "_field", "entrypoint"])
  |> sum()
entrypoints = data
  |> filter(fn: (r) => r._field == "${TRAEFIK_ENTRYPOINT_REQUESTS}")
  |> derivative(unit: 1s, nonNegative: true)
  |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)
  |> group(columns: ["_time", "_field", "entrypoint"])
  |> sum()
union(tables: [connections, entrypoints])
  |> yield(name: "proxy")`;
}

/** Open connections and requests per entrypoint, over time. */
export async function queryTraefikProxyHistory(range = "24h", window = "1h"): Promise<TraefikProxyHistory> {
  const rows = await runFluxQuery(buildTraefikProxyHistoryQuery(range, window), (row) => row);
  const perEntrypoint = (field: string) => sumPoints(rows, (row) => (row._field === field ? (row.entrypoint ?? null) : null));
  return {
    // A window's mean of a count: one decimal is all it is worth.
    connections: perEntrypoint(TRAEFIK_OPEN_CONNECTIONS).map((p) => ({ ...p, value: Math.round(p.value * 10) / 10 })),
    entrypoints: perEntrypoint(TRAEFIK_ENTRYPOINT_REQUESTS),
  };
}

export interface TraefikProxySnapshot {
  /** Connections open right now, all entrypoints together. */
  openConnections: number;
  /** Time of the newest reading. */
  time: string;
}

export function buildTraefikProxySnapshotQuery(range = "5m"): string {
  return latestQuery({ range, base: `r._measurement == "traefik"`, gauges: [pick("traefik", [TRAEFIK_OPEN_CONNECTIONS])] });
}

/** Traefik's live connection count; null when Telegraf wrote nothing in the range. */
export async function queryTraefikProxySnapshot(range = "5m"): Promise<TraefikProxySnapshot | null> {
  const rows = await runFluxQuery(buildTraefikProxySnapshotQuery(range), (row) => row);
  let openConnections = 0;
  let time = "";
  for (const row of rows) {
    const value = num(row._value);
    if (value === null) continue;
    openConnections += value;
    if ((row._time ?? "") > time) time = row._time ?? "";
  }
  return time ? { openConnections, time } : null;
}
