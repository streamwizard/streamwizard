import { runFluxQuery } from "../query-client";
import {
  TRAEFIK_DURATION_COUNT,
  TRAEFIK_DURATION_SUM,
  TRAEFIK_REQUESTS,
  any,
  latestQuery,
  num,
  pick,
  ratioPoints,
  seriesQuery,
  source,
  sumPoints,
  type Row,
  type WebserverMetricPoint,
} from "./webserver-flux";

// Dokploy server metrics for web-admin's /apps pages. One Telegraf on the host
// (telegraf repo, host/) writes them into the webserver bucket every 30 s.
// Only the prod org has that bucket: check orgHasBucket() before reading.
//   host        server_cpu, server_mem, server_swap, server_system,
//               server_disk (path), server_diskio (name), server_net
//               (interface), server_vmstat (oom_kill), docker (totals)
//   containers  docker_container_cpu / _mem / _net / _blkio: one series per
//               service, running containers only
//               docker_container_status / _health: one series per container
//               (the only ones that keep container_name), stopped ones too
//   requests    traefik: Prometheus counters and a duration histogram, per
//               service, code, method and protocol
// Container and Traefik series carry service (swarm service), app (monorepo
// app name) and env (prod | staging | shared | other). The same app in two
// environments shares the app tag, so an app is always `${env}:${app}`.
// Traefik's service tag differs from the container one for compose stacks,
// which is why the two are joined on app + env.
//
// Network, disk IO and every traefik field are counters: derivative() first.
// health_status is a string and oomkilled a boolean inside numeric
// measurements, so every query filters _field before any math.

// --- Input checks: every value below lands inside Flux source. ---

export const APP_ENVS = ["prod", "staging", "shared", "other"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

export function assertAppEnv(value: string): AppEnv {
  if (!isAppEnv(value)) throw new Error("Invalid env");
  return value;
}

const APP_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** App and service names: letters, digits, dot, dash, underscore. */
export function assertAppName(value: string): string {
  if (!APP_NAME_RE.test(value)) throw new Error("Invalid app");
  return value;
}

/** Key of one app in one environment: "<env>:<app>". */
export function appKey(env: string, app: string): string {
  return `${env}:${app}`;
}

export type { WebserverMetricPoint } from "./webserver-flux";

const CONTAINER_GAUGES = [pick("docker_container_cpu", ["usage_percent"]), pick("docker_container_mem", ["usage", "inactive_file"])];
const CONTAINER_NET = pick("docker_container_net", ["rx_bytes", "tx_bytes"]);
const CONTAINER_DISK = pick("docker_container_blkio", ["io_service_bytes_recursive_read", "io_service_bytes_recursive_write"]);
const TRAEFIK_COUNTERS = pick("traefik", [TRAEFIK_REQUESTS, TRAEFIK_DURATION_SUM, TRAEFIK_DURATION_COUNT]);

const appBase = (env: string, app: string) => `r.env == "${assertAppEnv(env)}" and r.app == "${assertAppName(app)}"`;

// ============================================================================
// Apps: the list
// ============================================================================

/** Live numbers of one app in one environment. */
export interface AppSnapshot {
  key: string;
  app: string;
  env: string;
  /** Swarm service or container name, as Dokploy named it. */
  service: string;
  /** Percent of one core: 100 is one core kept busy. */
  cpuPct: number | null;
  /** Memory in use without the reclaimable file cache, as `docker stats` counts it. */
  memBytes: number | null;
  /** The same plus that file cache: what the container's cgroup holds. */
  memTotalBytes: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  /** Time of the newest reading. */
  time: string;
}

export function buildAppSnapshotQuery(range = "5m"): string {
  return latestQuery({ range, gauges: CONTAINER_GAUGES, rates: [CONTAINER_NET] });
}

interface AppFields {
  app: string;
  env: string;
  service: string;
  time: string;
  fields: Map<string, number>;
}

/** Groups per-field rows by app + env. `name` picks the key inside `fields`. */
function byApp(rows: Row[], name: (row: Row) => string = (row) => row._field ?? ""): Map<string, AppFields> {
  const apps = new Map<string, AppFields>();
  for (const row of rows) {
    const value = num(row._value);
    if (!row.app || !row.env || value === null) continue;
    const key = appKey(row.env, row.app);
    let entry = apps.get(key);
    if (!entry) {
      entry = { app: row.app, env: row.env, service: row.service ?? "", time: "", fields: new Map() };
      apps.set(key, entry);
    }
    const field = name(row);
    entry.fields.set(field, (entry.fields.get(field) ?? 0) + value);
    if ((row._time ?? "") > entry.time) entry.time = row._time ?? "";
  }
  return apps;
}

// Telegraf's docker input already takes the reclaimable file cache
// (inactive_file) off its `usage` field, the way `docker stats` does. Checked
// against prod: the dokploy container reports usage below inactive_file. So
// usage is the working set, and the cache goes on top for the full figure.
const withFileCache = (usage: number | undefined, inactiveFile: number | undefined): number | null =>
  usage === undefined ? null : usage + (inactiveFile ?? 0);

/** Live CPU, memory and network of every app, all environments. */
export async function queryAppSnapshot(range = "5m"): Promise<AppSnapshot[]> {
  const rows = await runFluxQuery(buildAppSnapshotQuery(range), (row) => row);
  return [...byApp(rows).entries()].map(([key, a]) => ({
    key,
    app: a.app,
    env: a.env,
    service: a.service,
    cpuPct: a.fields.get("usage_percent") ?? null,
    memBytes: a.fields.get("usage") ?? null,
    memTotalBytes: withFileCache(a.fields.get("usage"), a.fields.get("inactive_file")),
    netRxBps: a.fields.get("rx_bytes") ?? null,
    netTxBps: a.fields.get("tx_bytes") ?? null,
    time: a.time,
  }));
}

/** One container of an app: the running one, or a stopped earlier task. */
export interface AppContainer {
  key: string;
  app: string;
  env: string;
  service: string;
  name: string;
  /** Docker state: running, exited, created, restarting, dead, … */
  state: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  oomKilled: boolean;
  /** Docker's own restart counter (restart policies, not swarm task replacement). */
  restartCount: number | null;
  /** healthy | unhealthy | starting, or null without a healthcheck. */
  health: string | null;
  failingStreak: number | null;
  /** Last time Telegraf reported this container. */
  lastSeen: string;
}

const STATUS_FIELDS = ["exitcode", "oomkilled", "restart_count", "started_at", "finished_at"];
const HEALTH_FIELDS = ["health_status", "failing_streak"];

export function buildAppContainersQuery(range = "24h", env?: string, app?: string): string {
  const scope = env && app ? `${appBase(env, app)} and ` : "";
  // Fields differ in type (int, bool, string), so each series keeps its own
  // table: last() only, and the rows are put together in TS.
  return `
${source(range)}
  |> filter(fn: (r) => ${scope}(${any([pick("docker_container_status", STATUS_FIELDS), pick("docker_container_health", HEALTH_FIELDS)])}))
  |> last()
  |> yield(name: "containers")`;
}

/** Telegraf writes container timestamps as nanoseconds since the epoch. */
const nsToIso = (v: string | undefined): string | null => {
  const ns = num(v);
  return ns === null || ns <= 0 ? null : new Date(ns / 1e6).toISOString();
};

/**
 * Every container Telegraf saw in the range, newest first: state, start and
 * stop time, exit code, OOM kill and health. Stopped swarm tasks stay listed
 * for as long as Docker keeps them, which is how a restart shows up.
 */
export async function queryAppContainers(range = "24h", env?: string, app?: string): Promise<AppContainer[]> {
  const rows = await runFluxQuery(buildAppContainersQuery(range, env, app), (row) => row);
  // The state is a tag, so one container has a series per state it was in.
  // Per field the newest row wins.
  const containers = new Map<string, { row: Row; lastSeen: string; fields: Map<string, { time: string; value: string }> }>();
  for (const row of rows) {
    const name = row.container_name;
    if (!name || !row.app || !row.env) continue;
    const time = row._time ?? "";
    let entry = containers.get(name);
    if (!entry) {
      entry = { row, lastSeen: "", fields: new Map() };
      containers.set(name, entry);
    }
    if (row._measurement === "docker_container_status" && time >= entry.lastSeen) {
      entry.row = row;
      entry.lastSeen = time;
    }
    const field = row._field ?? "";
    const seen = entry.fields.get(field);
    // The client hands back typed values whatever Row says: oomkilled arrives
    // as a boolean, not as "true".
    if (!seen || time > seen.time) entry.fields.set(field, { time, value: String(row._value ?? "") });
  }
  return [...containers.entries()]
    .map(([name, c]): AppContainer => {
      const field = (f: string) => c.fields.get(f)?.value;
      return {
        key: appKey(c.row.env!, c.row.app!),
        app: c.row.app!,
        env: c.row.env!,
        service: c.row.service ?? "",
        name,
        state: c.row.container_status ?? "",
        startedAt: nsToIso(field("started_at")),
        finishedAt: nsToIso(field("finished_at")),
        exitCode: num(field("exitcode")),
        oomKilled: field("oomkilled") === "true",
        restartCount: num(field("restart_count")),
        health: field("health_status") || null,
        failingStreak: num(field("failing_streak")),
        lastSeen: c.lastSeen,
      };
    })
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

/** Request numbers of one app in one environment, from Traefik. */
export interface AppTraffic {
  key: string;
  app: string;
  env: string;
  requestsPerSec: number;
  /** Share of answers with a 5xx status, 0 to 100. Null without requests. */
  errorPct: number | null;
  /** Mean time Traefik waited for the app. Null without requests. */
  meanMs: number | null;
}

export function buildAppTrafficQuery(range = "5m"): string {
  return `
${source(range)}
  |> filter(fn: (r) => ${TRAEFIK_COUNTERS})
  |> filter(fn: (r) => exists r.app and exists r.env)
  |> derivative(unit: 1s, nonNegative: true)
  |> mean()
  |> group(columns: ["app", "env", "code", "_field"])
  |> sum()
  |> yield(name: "traffic")`;
}

const isServerError = (code: string | undefined) => (code ?? "").startsWith("5");

/** Requests per second, error share and mean response time per app. */
export async function queryAppTraffic(range = "5m"): Promise<AppTraffic[]> {
  const rows = await runFluxQuery(buildAppTrafficQuery(range), (row) => row);
  const apps = byApp(rows, (row) => {
    if (row._field === TRAEFIK_REQUESTS) return isServerError(row.code) ? "errors" : "ok";
    return row._field === TRAEFIK_DURATION_SUM ? "seconds" : "timed";
  });
  return [...apps.entries()].map(([key, a]) => {
    const errors = a.fields.get("errors") ?? 0;
    const requests = errors + (a.fields.get("ok") ?? 0);
    const timed = a.fields.get("timed") ?? 0;
    return {
      key,
      app: a.app,
      env: a.env,
      requestsPerSec: requests,
      errorPct: requests > 0 ? (errors / requests) * 100 : null,
      meanMs: timed > 0 ? ((a.fields.get("seconds") ?? 0) / timed) * 1000 : null,
    };
  });
}

export interface AppSparkline {
  key: string;
  /** CPU %, one value per window, oldest first. */
  cpu: number[];
  /** Memory in use (without file cache), bytes, one value per window. */
  mem: number[];
}

export function buildAppSparklinesQuery(range = "1h", window = "5m"): string {
  return seriesQuery({ range, window, gauges: [pick("docker_container_cpu", ["usage_percent"]), pick("docker_container_mem", ["usage"])] });
}

/** Small per-app trend lines for the /apps tables, every app in one query. */
export async function queryAppSparklines(range = "1h", window = "5m"): Promise<AppSparkline[]> {
  const rows = await runFluxQuery(buildAppSparklinesQuery(range, window), (row) => row);
  const apps = new Map<string, { cpu: Map<string, number>; mem: Map<string, number> }>();
  for (const row of rows) {
    const value = num(row._value);
    if (!row.app || !row.env || value === null) continue;
    const key = appKey(row.env, row.app);
    let entry = apps.get(key);
    if (!entry) {
      entry = { cpu: new Map(), mem: new Map() };
      apps.set(key, entry);
    }
    (row._field === "usage_percent" ? entry.cpu : entry.mem).set(row._time ?? "", value);
  }
  const ordered = (m: Map<string, number>) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  return [...apps.entries()].map(([key, a]) => ({ key, cpu: ordered(a.cpu), mem: ordered(a.mem) }));
}

// ============================================================================
// Apps: one app's charts
// ============================================================================

/** Chart series of one app, keyed like the charts' dataKey. */
export interface AppHistory {
  cpu: WebserverMetricPoint[];
  /** "In use" (without file cache) and "With file cache". */
  memory: WebserverMetricPoint[];
  /** "In" and "Out", bytes/s. */
  network: WebserverMetricPoint[];
  /** "Read" and "Write", bytes/s. */
  disk: WebserverMetricPoint[];
  /** Requests per second per status class: 2xx, 3xx, 4xx, 5xx. */
  requests: WebserverMetricPoint[];
  /** Mean response time, ms. */
  responseMs: WebserverMetricPoint[];
}

export const emptyAppHistory = (): AppHistory => ({ cpu: [], memory: [], network: [], disk: [], requests: [], responseMs: [] });

export function buildAppHistoryQuery(env: string, app: string, range = "24h", window = "1h"): string {
  return seriesQuery({ range, window, base: appBase(env, app), gauges: CONTAINER_GAUGES, rates: [CONTAINER_NET, CONTAINER_DISK, TRAEFIK_COUNTERS] });
}

const fieldLabels = (measurement: string, labels: Record<string, string>) => (row: Row) =>
  row._measurement === measurement ? (labels[row._field ?? ""] ?? null) : null;

/** Every chart on one app's page. */
export async function queryAppHistory(env: string, app: string, range = "24h", window = "1h"): Promise<AppHistory> {
  const rows = await runFluxQuery(buildAppHistoryQuery(env, app, range, window), (row) => row);
  const usage = sumPoints(rows, fieldLabels("docker_container_mem", { usage: "In use" }));
  const cache = new Map(sumPoints(rows, fieldLabels("docker_container_mem", { inactive_file: "cache" })).map((p) => [p.time, p.value]));
  return {
    cpu: sumPoints(rows, fieldLabels("docker_container_cpu", { usage_percent: "CPU" })),
    memory: [...usage, ...usage.map((p) => ({ time: p.time, nodeId: "With file cache", value: p.value + (cache.get(p.time) ?? 0) }))],
    network: sumPoints(rows, fieldLabels("docker_container_net", { rx_bytes: "In", tx_bytes: "Out" })),
    disk: sumPoints(rows, fieldLabels("docker_container_blkio", { io_service_bytes_recursive_read: "Read", io_service_bytes_recursive_write: "Write" })),
    requests: sumPoints(rows, (row) => (row._field === TRAEFIK_REQUESTS && row.code ? `${row.code.charAt(0)}xx` : null)),
    responseMs: ratioPoints(
      rows,
      "Mean",
      (row) => row._field === TRAEFIK_DURATION_SUM,
      (row) => row._field === TRAEFIK_DURATION_COUNT,
      1000,
    ),
  };
}

// ============================================================================
// The server itself
// ============================================================================

/** Network interfaces that carry the server's real traffic. Tailscale rides on
 * top of these, so counting it too would count those bytes twice. */
const PHYSICAL_NIC = `r.interface !~ /^tailscale/`;

const SERVER_GAUGES = [
  pick("server_cpu", ["usage_active", "usage_iowait", "usage_steal"]),
  pick("server_mem", ["total", "used", "available", "used_percent"]),
  pick("server_swap", ["total", "used", "used_percent"]),
  pick("server_system", ["load1", "load5", "load15", "n_cpus", "uptime"]),
  pick("server_disk", ["total", "used", "used_percent", "inodes_used_percent"]),
  pick("docker", ["n_containers_running"]),
];
/** What swarm wants and has for one service. Compose and plain containers have no row. */
export interface AppTasks {
  key: string;
  app: string;
  env: string;
  service: string;
  /** Replicas asked for: 0 when the service was scaled down on purpose. */
  desired: number | null;
  running: number | null;
  time: string;
}

export function buildAppTasksQuery(range = "5m"): string {
  return `
${source(range)}
  |> filter(fn: (r) => ${pick("docker_swarm", ["tasks_desired", "tasks_running"])})
  |> last()
  |> yield(name: "tasks")`;
}

/** Desired and running task counts of every swarm service, all environments. */
export async function queryAppTasks(range = "5m"): Promise<AppTasks[]> {
  const rows = await runFluxQuery(buildAppTasksQuery(range), (row) => row);
  return [...byApp(rows).entries()].map(([key, a]) => ({
    key,
    app: a.app,
    env: a.env,
    service: a.service,
    desired: a.fields.get("tasks_desired") ?? null,
    running: a.fields.get("tasks_running") ?? null,
    time: a.time,
  }));
}

const SERVER_NET = `(${pick("server_net", ["bytes_recv", "bytes_sent"])} and ${PHYSICAL_NIC})`;
const SERVER_DISK_IO = pick("server_diskio", ["read_bytes", "write_bytes"]);
const SERVER_OOM = pick("server_vmstat", ["oom_kill"]);

/** Live numbers of the Dokploy server. */
export interface ServerSnapshot {
  host: string;
  /** Time of the newest reading. */
  time: string;
  cpuPct: number | null;
  iowaitPct: number | null;
  stealPct: number | null;
  memUsedPct: number | null;
  memUsed: number | null;
  memTotal: number | null;
  swapUsedPct: number | null;
  swapUsed: number | null;
  swapTotal: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  cpus: number | null;
  uptimeSeconds: number | null;
  diskUsedPct: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  inodesUsedPct: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  containersRunning: number | null;
}

export function buildServerSnapshotQuery(range = "5m"): string {
  return latestQuery({ range, gauges: SERVER_GAUGES, rates: [SERVER_NET] });
}

/** The server's live numbers; null when Telegraf wrote nothing in the range. */
export async function queryServerSnapshot(range = "5m"): Promise<ServerSnapshot | null> {
  const rows = await runFluxQuery(buildServerSnapshotQuery(range), (row) => row);
  const fields = new Map<string, number>();
  let host = "";
  let time = "";
  for (const row of rows) {
    const value = num(row._value);
    if (value === null) continue;
    // Rates come per interface and are summed; a gauge has one series.
    const id = `${row._measurement}.${row._field}`;
    fields.set(id, row._measurement === "server_net" ? (fields.get(id) ?? 0) + value : value);
    if (row.host) host = row.host;
    if (row._measurement !== "server_net" && (row._time ?? "") > time) time = row._time ?? "";
  }
  if (!time) return null;
  const get = (id: string) => fields.get(id) ?? null;
  return {
    host,
    time,
    cpuPct: get("server_cpu.usage_active"),
    iowaitPct: get("server_cpu.usage_iowait"),
    stealPct: get("server_cpu.usage_steal"),
    memUsedPct: get("server_mem.used_percent"),
    memUsed: get("server_mem.used"),
    memTotal: get("server_mem.total"),
    swapUsedPct: get("server_swap.used_percent"),
    swapUsed: get("server_swap.used"),
    swapTotal: get("server_swap.total"),
    load1: get("server_system.load1"),
    load5: get("server_system.load5"),
    load15: get("server_system.load15"),
    cpus: get("server_system.n_cpus"),
    uptimeSeconds: get("server_system.uptime"),
    diskUsedPct: get("server_disk.used_percent"),
    diskUsed: get("server_disk.used"),
    diskTotal: get("server_disk.total"),
    inodesUsedPct: get("server_disk.inodes_used_percent"),
    netRxBps: get("server_net.bytes_recv"),
    netTxBps: get("server_net.bytes_sent"),
    containersRunning: get("docker.n_containers_running"),
  };
}

export function buildServerOomKillsQuery(range = "24h"): string {
  return `
${source(range)}
  |> filter(fn: (r) => ${SERVER_OOM})
  |> difference(nonNegative: true)
  |> sum()
  |> yield(name: "oom_kills")`;
}

/** Processes the kernel killed for memory in the range, the whole server. */
export async function queryServerOomKills(range = "24h"): Promise<number> {
  const rows = await runFluxQuery(buildServerOomKillsQuery(range), (row) => num(row._value) ?? 0);
  return rows.reduce((sum, n) => sum + n, 0);
}

/** Chart series of the server, keyed like the charts' dataKey. */
export interface ServerHistory {
  /** "In use", "Waiting on disk" and "Stolen", percent of all cores. */
  cpu: WebserverMetricPoint[];
  memory: WebserverMetricPoint[];
  swap: WebserverMetricPoint[];
  /** "1 min", "5 min" and "15 min". */
  load: WebserverMetricPoint[];
  disk: WebserverMetricPoint[];
  /** "Read" and "Write", bytes/s over all disks. */
  diskIo: WebserverMetricPoint[];
  /** "In" and "Out", bytes/s. */
  network: WebserverMetricPoint[];
  /** OOM kills per window. */
  oomKills: WebserverMetricPoint[];
}

export const emptyServerHistory = (): ServerHistory => ({ cpu: [], memory: [], swap: [], load: [], disk: [], diskIo: [], network: [], oomKills: [] });

export function buildServerHistoryQuery(range = "24h", window = "1h"): string {
  return seriesQuery({
    range,
    window,
    gauges: [
      pick("server_cpu", ["usage_active", "usage_iowait", "usage_steal"]),
      pick("server_mem", ["used_percent"]),
      pick("server_swap", ["used_percent"]),
      pick("server_system", ["load1", "load5", "load15"]),
      pick("server_disk", ["used_percent"]),
    ],
    rates: [SERVER_NET, SERVER_DISK_IO],
    deltas: [SERVER_OOM],
  });
}

/** Every chart on the server page. */
export async function queryServerHistory(range = "24h", window = "1h"): Promise<ServerHistory> {
  const rows = await runFluxQuery(buildServerHistoryQuery(range, window), (row) => row);
  return {
    cpu: sumPoints(rows, fieldLabels("server_cpu", { usage_active: "In use", usage_iowait: "Waiting on disk", usage_steal: "Stolen" })),
    memory: sumPoints(rows, fieldLabels("server_mem", { used_percent: "Memory" })),
    swap: sumPoints(rows, fieldLabels("server_swap", { used_percent: "Swap" })),
    load: sumPoints(rows, fieldLabels("server_system", { load1: "1 min", load5: "5 min", load15: "15 min" })),
    disk: sumPoints(rows, fieldLabels("server_disk", { used_percent: "/" })),
    diskIo: sumPoints(rows, fieldLabels("server_diskio", { read_bytes: "Read", write_bytes: "Write" })),
    network: sumPoints(rows, fieldLabels("server_net", { bytes_recv: "In", bytes_sent: "Out" })),
    oomKills: sumPoints(rows, fieldLabels("server_vmstat", { oom_kill: "OOM kills" })),
  };
}
