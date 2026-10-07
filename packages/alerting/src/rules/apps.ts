import {
  BUCKETS,
  EXPECTED_APPS,
  STALE_AFTER_MS,
  appKey,
  isFailedExit,
  liveContainers,
  orgHasBucket,
  queryAppContainers,
  queryAppSnapshot,
  queryAppTasks,
  queryLastWriteByTag,
  queryServerOomKills,
  queryServerSnapshot,
  unplannedStops,
  type AppContainer,
} from "@repo/metrics";
import type { AlertRule, Breach, EnvContext, RuleOverrides, Severity } from "../types";
import { customRule, perTick, thresholdRule } from "./builders";
import {
  APP_CRASH_COUNT,
  APP_CRASH_WINDOW_MIN,
  APP_MEMORY_BUDGET_MB,
  APP_MEMORY_CRIT_PCT,
  APP_MEMORY_WARN_PCT,
  APP_RESTART_LOOP_COUNT,
  APP_RESTART_LOOP_WINDOW_MIN,
  SERVER_DISK_CRIT_PCT,
  SERVER_DISK_WARN_PCT,
  SERVER_OOM_WINDOW_MIN,
  TELEGRAF_SILENT_MIN,
} from "./thresholds";

// Apps on the Dokploy server (app.*) and the server itself (server.*), read
// from what the host's Telegraf writes to the webserver bucket. Only the prod
// org has that bucket, so the prod alert-worker watches the whole server: an
// entity is "<env>:<app>".
//
// Staging runs on the same server but is not always on, so its apps are left
// out unless the switch below is turned on. They never go above warn.

/**
 * Not a check: a switch. Enabling this rule on /alerts/rules makes the app.*
 * rules watch the staging apps too. It lives in the rule list because that is
 * where an admin can flip it without a deploy.
 */
export const WATCH_STAGING_RULE_ID = "app.watch_staging";

const MB = 1024 * 1024;
const MINUTE = 60_000;

// An hour back, so a container Docker already removed still counts as the
// app's last known state for a while.
const containers = perTick(() => queryAppContainers("1h"));
const tasks = perTick(() => queryAppTasks("5m"));
const snapshots = perTick(() => queryAppSnapshot("5m"));
const server = perTick(() => queryServerSnapshot("5m"));
const lastReports = perTick(() => queryLastWriteByTag("server_cpu", "host", "24h"));

const hasData = () => orgHasBucket(BUCKETS.webserver);
const ageMs = (ctx: EnvContext, iso: string) => (iso ? ctx.now.getTime() - Date.parse(iso) : Infinity);
/** "95 s" under two minutes, "12 min" after. */
const silentFor = (ms: number) => (ms < 120_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / MINUTE)} min`);
const times = (n: number) => (n === 1 ? "once" : `${n} times`);

/**
 * The server whose Telegraf is still writing, or undefined. Without fresh
 * data nothing below can tell a dead app from a blind spot, so every other
 * rule stays quiet and server.telegraf_silent is the one that fires.
 */
async function reportingHost(ctx: EnvContext): Promise<string | undefined> {
  if (!hasData()) return undefined;
  return (await lastReports(ctx)).find((r) => ageMs(ctx, r.lastSeen) <= STALE_AFTER_MS)?.tagValue;
}

interface WatchedApp {
  env: string;
  app: string;
  /** Entity id. */
  key: string;
  label: string;
}

const labelOf = (env: string, app: string) => `${app} (${env})`;

/** "rest-api (prod)" for the entity id "prod:rest-api". */
export function appEntityLabel(entityId: string): string | undefined {
  const cut = entityId.indexOf(":");
  return cut > 0 && cut < entityId.length - 1 ? labelOf(entityId.slice(0, cut), entityId.slice(cut + 1)) : undefined;
}

/** The apps that belong on the server; none while Telegraf is silent. */
async function watchedApps(ctx: EnvContext, staging: boolean): Promise<WatchedApp[]> {
  if (!(await reportingHost(ctx))) return [];
  return EXPECTED_APPS.filter(({ env }) => staging || env !== "staging").map(({ env, app }) => ({
    env,
    app,
    key: appKey(env, app),
    label: labelOf(env, app),
  }));
}

/** When Telegraf last reported any container, in ms; undefined when it has none. */
function newestContainerReport(all: AppContainer[]): number | undefined {
  const newest = Math.max(...all.map((c) => Date.parse(c.lastSeen)).filter((t) => !Number.isNaN(t)));
  return Number.isFinite(newest) ? newest : undefined;
}

interface AppContainers extends WatchedApp {
  /** Every container Telegraf saw of the app, newest first. */
  containers: AppContainer[];
  /** The ones that are running. */
  live: AppContainer[];
}

/**
 * Each watched app with its containers; none while the container data is old.
 * Telegraf's docker input can fail or lag on its own while the server numbers
 * keep coming, and then every app would read as down. So "running" is judged
 * as of the newest container report, not as of now.
 */
async function appsWithContainers(ctx: EnvContext, staging: boolean): Promise<AppContainers[]> {
  const apps = await watchedApps(ctx, staging);
  if (apps.length === 0) return [];
  const all = await containers(ctx);
  const asOf = newestContainerReport(all);
  if (asOf === undefined || ctx.now.getTime() - asOf > STALE_AFTER_MS) return [];
  const byApp = new Map<string, AppContainer[]>();
  for (const c of all) byApp.set(c.key, [...(byApp.get(c.key) ?? []), c]);
  return apps.map((a) => {
    const own = byApp.get(a.key) ?? [];
    return { ...a, containers: own, live: liveContainers(own, asOf) };
  });
}

/** Staging, when it is watched at all, must not page anyone. */
const capped = (env: string, severity: Severity): Severity => (env === "staging" ? "warn" : severity);

const exitOf = (c: AppContainer) => (c.exitCode === null ? `is ${c.state || "gone"}` : `exited with code ${c.exitCode}`);

export function appRules(overrides: RuleOverrides): AlertRule[] {
  const staging = overrides[WATCH_STAGING_RULE_ID]?.enabled ?? false;
  return [
    customRule(
      {
        id: WATCH_STAGING_RULE_ID,
        title: "Watch staging apps too (switch)",
        forTicks: 1,
        envs: ["prod"],
        enabled: false,
        evaluate: async () => [],
      },
      overrides,
    ),
    customRule(
      {
        id: "app.down",
        title: "App down",
        forTicks: 2,
        envs: ["prod"],
        async evaluate(ctx) {
          const apps = await appsWithContainers(ctx, staging);
          if (apps.length === 0) return [];
          const desired = new Map((await tasks(ctx)).map((t) => [t.key, t.desired]));
          const breaches: Breach[] = [];
          for (const a of apps) {
            // Never reported: not deployed yet, or Dokploy renamed the service
            // and Telegraf's table (host/apps.star) lags. Not an outage.
            const newest = a.containers[0];
            if (!newest) continue;
            if (a.live.length > 0) continue;
            // Scaled to zero on purpose.
            if (desired.get(a.key) === 0) continue;
            breaches.push({
              entityId: a.key,
              severity: capped(a.env, "crit"),
              message: `${a.label} has no running container (the last one ${exitOf(newest)})`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "app.crash",
        title: "App crashed",
        forTicks: 1,
        envs: ["prod"],
        crit: { default: APP_CRASH_COUNT, unit: `crashes / ${APP_CRASH_WINDOW_MIN}m`, direction: "above" },
        async evaluate(ctx, t) {
          const breaches: Breach[] = [];
          for (const a of await appsWithContainers(ctx, staging)) {
            // OOM kills are app.oom_kill's, so one death is one alert.
            const crashes = unplannedStops(a.containers, ctx.now.getTime(), APP_CRASH_WINDOW_MIN * MINUTE).filter(
              (c) => isFailedExit(c) && !c.oomKilled,
            );
            const last = crashes[0];
            if (!last || crashes.length < t.crit) continue;
            breaches.push({
              entityId: a.key,
              severity: capped(a.env, "crit"),
              value: crashes.length,
              message:
                crashes.length === 1
                  ? `${a.label} crashed with exit code ${last.exitCode}`
                  : `${a.label} crashed ${crashes.length} times in ${APP_CRASH_WINDOW_MIN} min, last exit code ${last.exitCode}`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "app.oom_kill",
        title: "App killed for memory",
        forTicks: 1,
        envs: ["prod"],
        async evaluate(ctx) {
          const breaches: Breach[] = [];
          for (const a of await appsWithContainers(ctx, staging)) {
            const kills = a.containers.filter(
              (c) => c.state !== "running" && c.oomKilled && ageMs(ctx, c.finishedAt ?? "") <= APP_CRASH_WINDOW_MIN * MINUTE,
            );
            if (kills.length === 0) continue;
            breaches.push({
              entityId: a.key,
              severity: capped(a.env, "crit"),
              value: kills.length,
              message: `${a.label} was killed for running out of memory ${times(kills.length)} in ${APP_CRASH_WINDOW_MIN} min`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "app.restart_loop",
        title: "App keeps restarting",
        forTicks: 1,
        envs: ["prod"],
        crit: { default: APP_RESTART_LOOP_COUNT, unit: `restarts / ${APP_RESTART_LOOP_WINDOW_MIN}m`, direction: "above" },
        async evaluate(ctx, t) {
          const breaches: Breach[] = [];
          for (const a of await appsWithContainers(ctx, staging)) {
            // Any exit code: an app swarm keeps killing for a failing
            // healthcheck stops cleanly every time.
            const stops = unplannedStops(a.containers, ctx.now.getTime(), APP_RESTART_LOOP_WINDOW_MIN * MINUTE);
            if (stops.length === 0 || stops.length < t.crit) continue;
            breaches.push({
              entityId: a.key,
              severity: capped(a.env, "crit"),
              value: stops.length,
              message: `${a.label} restarted ${stops.length} times in ${APP_RESTART_LOOP_WINDOW_MIN} min without a deploy`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "app.unhealthy",
        title: "App failing its healthcheck",
        // Swarm replaces an unhealthy task within seconds, which shows up as a
        // restart. This is for what stays unhealthy: a container nothing replaces.
        forTicks: 3,
        envs: ["prod"],
        async evaluate(ctx) {
          const breaches: Breach[] = [];
          for (const a of await appsWithContainers(ctx, staging)) {
            const unhealthy = a.live.find((c) => c.health === "unhealthy");
            if (!unhealthy) continue;
            breaches.push({
              entityId: a.key,
              severity: capped(a.env, "crit"),
              value: unhealthy.failingStreak ?? undefined,
              message: `${a.label} is running but fails its healthcheck${unhealthy.failingStreak ? ` (${unhealthy.failingStreak} checks in a row)` : ""}`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "app.memory_high",
        title: "App memory high",
        forTicks: 5,
        envs: ["prod"],
        warn: { default: APP_MEMORY_WARN_PCT, unit: "% of budget", direction: "above" },
        crit: { default: APP_MEMORY_CRIT_PCT, unit: "% of budget", direction: "above" },
        async evaluate(ctx, t) {
          const apps = await watchedApps(ctx, staging);
          if (apps.length === 0) return [];
          const live = new Map((await snapshots(ctx)).map((s) => [s.key, s]));
          const breaches: Breach[] = [];
          for (const a of apps) {
            const budgetMb = APP_MEMORY_BUDGET_MB[a.env]?.[a.app];
            const snap = live.get(a.key);
            if (!budgetMb || !snap || snap.memBytes === null || ageMs(ctx, snap.time) > STALE_AFTER_MS) continue;
            const usedMb = snap.memBytes / MB;
            const share = (usedMb / budgetMb) * 100;
            if (!(share > t.warn) && !(share > t.crit)) continue;
            breaches.push({
              entityId: a.key,
              severity: capped(a.env, share > t.crit ? "crit" : "warn"),
              value: share,
              message: `${a.label} uses ${usedMb.toFixed(0)} MB, ${share.toFixed(0)}% of its ${budgetMb} MB budget`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "server.disk_high",
        title: "Dokploy server disk filling up",
        forTicks: 2,
        envs: ["prod"],
        warn: SERVER_DISK_WARN_PCT,
        crit: SERVER_DISK_CRIT_PCT,
        unit: "%",
        fetch: async (ctx) => {
          const host = await reportingHost(ctx);
          const value = host ? (await server(ctx))?.diskUsedPct : null;
          return host && value != null ? [{ entityId: host, value }] : [];
        },
        format: (id, v, t) => `Disk on ${id} at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    customRule(
      {
        id: "server.oom_kill",
        title: "Dokploy server ran out of memory",
        forTicks: 1,
        envs: ["prod"],
        // Warn only: the app that was killed has its own alert. This one says
        // the whole server was out of memory, not one container over a limit.
        async evaluate(ctx) {
          const host = await reportingHost(ctx);
          if (!host) return [];
          const kills = await queryServerOomKills(`${SERVER_OOM_WINDOW_MIN}m`);
          if (kills <= 0) return [];
          return [
            {
              entityId: host,
              severity: "warn",
              value: kills,
              message: `${host} ran out of memory: the kernel killed a process ${times(kills)} in ${SERVER_OOM_WINDOW_MIN} min`,
            },
          ];
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "server.telegraf_silent",
        title: "Dokploy server stopped reporting",
        forTicks: 2,
        envs: ["prod"],
        crit: { default: TELEGRAF_SILENT_MIN, unit: "min", direction: "above" },
        // Servers are the hosts that wrote in the last 24 hours, so one that
        // never reported is not an outage.
        async evaluate(ctx, t) {
          if (!hasData()) return [];
          const breaches: Breach[] = [];
          for (const report of await lastReports(ctx)) {
            const silentMs = ageMs(ctx, report.lastSeen);
            if (silentMs <= t.crit * MINUTE) continue;
            breaches.push({
              entityId: report.tagValue,
              severity: "crit",
              value: Math.round(silentMs / 1000),
              message: `Telegraf on ${report.tagValue} hasn't reported for ${silentFor(silentMs)}: no app or server data, so their alerts are blind`,
            });
          }
          // The server numbers arrive but the container ones do not: Telegraf
          // lost the Docker socket. The app.* rules are blind then too.
          const host = await reportingHost(ctx);
          if (host) {
            const newest = newestContainerReport(await containers(ctx));
            const silentMs = newest === undefined ? Infinity : ctx.now.getTime() - newest;
            if (silentMs > t.crit * MINUTE) {
              breaches.push({
                entityId: `${host}:containers`,
                severity: "crit",
                value: Number.isFinite(silentMs) ? Math.round(silentMs / 1000) : undefined,
                message: `Telegraf on ${host} reports the server but no containers${Number.isFinite(silentMs) ? ` for ${silentFor(silentMs)}` : ""}: the app alerts are blind`,
              });
            }
          }
          return breaches;
        },
      },
      overrides,
    ),
  ];
}
