import type { AppContainer, AppSnapshot, AppSparkline, AppTraffic } from "@repo/metrics";

// The /apps page's logic, kept free of server imports so it can be unit-tested:
// which apps to expect, and how container, health and request data become one
// row per app per environment.

export type AppEnv = "prod" | "staging" | "shared" | "other";

export const ENV_LABEL: Record<AppEnv, string> = {
  prod: "Production",
  staging: "Staging",
  shared: "Shared",
  other: "Other",
};

/** The environments that are ours, in page order. "other" is the rest of the server. */
export const OUR_ENVS = ["prod", "staging", "shared"] as const satisfies readonly AppEnv[];

const MONOREPO_APPS = [
  "rest-api",
  "ws-server",
  "web-streamwizard",
  "web-overlay",
  "web-admin",
  "streamwizard-bot",
  "discord-bot",
  "obs-auto-switcher",
  "alert-worker",
];

// One instance of these serves both environments.
const SHARED_APPS = ["traefik", "influxdb", "dokploy", "dokploy-postgres", "dokploy-redis", "host-telegraf"];

/**
 * Apps that should be on the server. Each gets a row even when Telegraf has
 * nothing on it, so a missing app reads as "No data" instead of not being
 * there. The names are the app tags Telegraf writes (telegraf repo,
 * host/apps.star): add an app there and here.
 */
export const EXPECTED_APPS: readonly { env: AppEnv; app: string }[] = [
  ...MONOREPO_APPS.map((app) => ({ env: "prod" as const, app })),
  ...MONOREPO_APPS.map((app) => ({ env: "staging" as const, app })),
  ...SHARED_APPS.map((app) => ({ env: "shared" as const, app })),
];

export const appRowKey = (env: string, app: string) => `${env}:${app}`;

/** Telegraf writes every 30 s. After this long without a reading the numbers
 * are old, and a container that was running counts as gone. */
export const STALE_AFTER_MS = 120_000;

/** Restarts are counted over this window. */
export const RESTART_WINDOW_MS = 24 * 3_600_000;

// 0 is a clean stop, 143 is SIGTERM: what Docker sends the old container on a deploy.
const NORMAL_EXIT_CODES = new Set([0, 143]);

/**
 * - healthy / unhealthy / starting: what the container's healthcheck says
 * - running: up, no healthcheck to ask
 * - stopped: we know its containers and none is running
 * - nodata: Telegraf has nothing on it
 */
export type AppHealth = "healthy" | "unhealthy" | "starting" | "running" | "stopped" | "nodata";

/** Plain, serializable row for the tables. */
export interface AppRow {
  key: string;
  app: string;
  env: AppEnv;
  /** Swarm service or container name; "" when unknown. */
  service: string;
  /** In EXPECTED_APPS. */
  expected: boolean;
  health: AppHealth;
  /** The live numbers are older than STALE_AFTER_MS. */
  stale: boolean;
  lastSeen: string;
  cpuPct: number | null;
  memBytes: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  /** Containers started in the last 24 h. A deploy counts as one. */
  starts: number;
  /** Of those that stopped in the last 24 h: exit code other than 0 or 143, or OOM-killed. */
  failed: number;
  oomKills: number;
  /** Null when Traefik has no route to this app. */
  requestsPerSec: number | null;
  errorPct: number | null;
  meanMs: number | null;
  cpuSpark: number[];
  memSpark: number[];
}

const isRecent = (iso: string | null | undefined, now: number, withinMs: number) => !!iso && now - Date.parse(iso) <= withinMs;

/** A stop that is not a deploy or a clean exit. */
export function isFailedExit(c: Pick<AppContainer, "state" | "exitCode" | "oomKilled">): boolean {
  if (c.state === "running") return false;
  return c.oomKilled || (c.exitCode !== null && !NORMAL_EXIT_CODES.has(c.exitCode));
}

/** Containers that are running and still being reported. */
export function liveContainers(containers: AppContainer[], now: number): AppContainer[] {
  return containers.filter((c) => c.state === "running" && isRecent(c.lastSeen, now, STALE_AFTER_MS));
}

const HEALTH_RANK: Record<string, number> = { unhealthy: 3, starting: 2, healthy: 1 };

/** The worst healthcheck result among the running containers. */
export function healthOf(containers: AppContainer[], hasMetrics: boolean, now: number): AppHealth {
  const live = liveContainers(containers, now);
  if (live.length === 0) {
    if (containers.length > 0) return "stopped";
    return hasMetrics ? "running" : "nodata";
  }
  let worst: AppHealth = "running";
  let rank = 0;
  for (const c of live) {
    const r = HEALTH_RANK[c.health ?? ""] ?? 0;
    if (r > rank) {
      rank = r;
      worst = c.health as AppHealth;
    }
  }
  return worst;
}

export function restartStats(containers: AppContainer[], now: number): { starts: number; failed: number; oomKills: number } {
  const stopped = containers.filter((c) => c.state !== "running" && isRecent(c.finishedAt ?? c.lastSeen, now, RESTART_WINDOW_MS));
  return {
    starts: containers.filter((c) => isRecent(c.startedAt, now, RESTART_WINDOW_MS)).length,
    failed: stopped.filter(isFailedExit).length,
    oomKills: stopped.filter((c) => c.oomKilled).length,
  };
}

const toEnv = (env: string): AppEnv => (env === "prod" || env === "staging" || env === "shared" ? env : "other");

/**
 * One row per app per environment: every expected app, plus whatever else
 * Telegraf reports. Each source is optional: a query that failed leaves its
 * columns blank and the row in place.
 */
export function buildAppRows(
  data: { snapshot: AppSnapshot[]; containers: AppContainer[]; traffic: AppTraffic[]; sparklines: AppSparkline[] },
  now: number,
  expected: readonly { env: AppEnv; app: string }[] = EXPECTED_APPS,
): AppRow[] {
  const snapshots = new Map(data.snapshot.map((s) => [s.key, s]));
  const traffic = new Map(data.traffic.map((t) => [t.key, t]));
  const sparks = new Map(data.sparklines.map((s) => [s.key, s]));
  const containers = new Map<string, AppContainer[]>();
  for (const c of data.containers) containers.set(c.key, [...(containers.get(c.key) ?? []), c]);

  const identities = new Map<string, { env: AppEnv; app: string; expected: boolean }>();
  for (const e of expected) identities.set(appRowKey(e.env, e.app), { ...e, expected: true });
  // Traffic alone does not make a row: Traefik also routes to things that are not containers here.
  for (const s of [...data.snapshot, ...data.containers]) {
    if (!identities.has(s.key)) identities.set(s.key, { env: toEnv(s.env), app: s.app, expected: false });
  }

  // When Telegraf itself went quiet nothing is "running and still reported".
  // Judge the containers as of its last report then, and mark every row old.
  const lastReport = [...data.snapshot.map((s) => s.time), ...data.containers.map((c) => c.lastSeen)].reduce((newest, t) => (t > newest ? t : newest), "");
  const silent = !!lastReport && !isRecent(lastReport, now, STALE_AFTER_MS);
  const asOf = silent ? Date.parse(lastReport) : now;

  return [...identities.entries()].map(([key, id]) => {
    const snap = snapshots.get(key);
    const own = containers.get(key) ?? [];
    const reqs = traffic.get(key);
    const spark = sparks.get(key);
    const health = healthOf(own, !!snap, asOf);
    const stale = silent || (!!snap && !isRecent(snap.time, now, STALE_AFTER_MS));
    // Old numbers of a container that is gone would read as its current load.
    const live = snap && isRecent(snap.time, asOf, STALE_AFTER_MS) && health !== "stopped" ? snap : null;
    return {
      key,
      app: id.app,
      env: id.env,
      service: snap?.service || own[0]?.service || "",
      expected: id.expected,
      health,
      stale,
      lastSeen: snap?.time ?? own.reduce((newest, c) => (c.lastSeen > newest ? c.lastSeen : newest), ""),
      cpuPct: live?.cpuPct ?? null,
      memBytes: live?.memBytes ?? null,
      netRxBps: live?.netRxBps ?? null,
      netTxBps: live?.netTxBps ?? null,
      ...restartStats(own, now),
      requestsPerSec: reqs?.requestsPerSec ?? null,
      errorPct: reqs?.errorPct ?? null,
      meanMs: reqs?.meanMs ?? null,
      cpuSpark: live ? (spark?.cpu ?? []) : [],
      memSpark: live ? (spark?.mem ?? []) : [],
    };
  });
}

const byName = (a: AppRow, b: AppRow) => a.app.localeCompare(b.app);

/** Rows of one of our environments, expected apps in their listed order, extras after. */
export function rowsOf(rows: AppRow[], env: AppEnv, expected: readonly { env: AppEnv; app: string }[] = EXPECTED_APPS): AppRow[] {
  const order = new Map(expected.filter((e) => e.env === env).map((e, i) => [e.app, i]));
  return rows
    .filter((r) => r.env === env)
    .sort((a, b) => (order.get(a.app) ?? Infinity) - (order.get(b.app) ?? Infinity) || byName(a, b));
}

/** True when not one source returned anything about any app. */
export function hasNoAppData(rows: AppRow[]): boolean {
  return rows.every((r) => r.health === "nodata" && r.requestsPerSec === null);
}
