import type { AppContainer, AppSnapshot, AppSparkline, AppTraffic } from "@repo/metrics";
import { EXPECTED_APPS, STALE_AFTER_MS, isDeployStop, isFailedExit, liveContainers } from "@repo/metrics/apps-model";

// The /apps page's logic, kept free of server imports so it can be unit-tested:
// how container, health and request data become one row per app per
// environment. Which apps to expect and how a container's state reads is
// shared with the app.* alert rules: @repo/metrics/apps-model.

export { EXPECTED_APPS, STALE_AFTER_MS, isFailedExit, liveContainers };

export type AppEnv = "prod" | "staging" | "shared" | "other";

export const ENV_LABEL: Record<AppEnv, string> = {
  prod: "Production",
  staging: "Staging",
  shared: "Shared",
  other: "Other",
};

/** The environments that are ours, in page order. "other" is the rest of the server. */
export const OUR_ENVS = ["prod", "staging", "shared"] as const satisfies readonly AppEnv[];

export const appRowKey = (env: string, app: string) => `${env}:${app}`;

/** Restarts are counted over this window. */
export const RESTART_WINDOW_MS = 24 * 3_600_000;

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
  /** Of those that stopped in the last 24 h, deploys aside: exit code other than 0 or 143, or OOM-killed. */
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
    // A container that is slow to stop leaves 137 on a normal deploy.
    failed: stopped.filter((c) => isFailedExit(c) && (c.oomKilled || !isDeployStop(c, containers))).length,
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
