import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AppContainer, AppSnapshot, AppTasks, LastWriteByTag, ServerSnapshot } from "@repo/metrics";
import type { EnvContext } from "../types";

let influxContainers: AppContainer[] = [];
let influxTasks: AppTasks[] = [];
let influxSnapshots: AppSnapshot[] = [];
let influxServer: Partial<ServerSnapshot> | null = null;
let influxLastReports: LastWriteByTag[] = [];
let influxOomKills = 0;
let influxReads = 0;
// Keep every other export real: bun's module mocks are process-wide, and
// other test files import @repo/metrics too.
const realMetrics = await import("@repo/metrics");
const read = <T>(value: () => T) => async () => {
  influxReads++;
  return value();
};
mock.module("@repo/metrics", () => ({
  ...realMetrics,
  queryAppContainers: read(() => influxContainers),
  queryAppTasks: read(() => influxTasks),
  queryAppSnapshot: read(() => influxSnapshots),
  queryServerSnapshot: read(() => influxServer),
  queryServerOomKills: read(() => influxOomKills),
  queryLastWriteByTag: read(() => influxLastReports),
}));

const { WATCH_STAGING_RULE_ID, appEntityLabel, appRules } = await import("./apps");

const NOW = new Date("2026-10-06T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();
const MB = 1024 * 1024;

let names = 0;
function container(over: Partial<AppContainer> = {}): AppContainer {
  const env = over.env ?? "prod";
  const app = over.app ?? "rest-api";
  return {
    key: `${env}:${app}`,
    app,
    env,
    service: `${app}-service`,
    name: `${app}.${++names}`,
    state: "running",
    startedAt: ago(3 * 86_400),
    finishedAt: null,
    exitCode: 0,
    oomKilled: false,
    restartCount: 0,
    health: "healthy",
    failingStreak: 0,
    lastSeen: ago(20),
    ...over,
  };
}

/** A container that ran for a minute and stopped `secondsAgo` ago. */
const stopped = (secondsAgo: number, over: Partial<AppContainer> = {}) =>
  container({ state: "exited", startedAt: ago(secondsAgo + 60), finishedAt: ago(secondsAgo), exitCode: 1, health: "unhealthy", ...over });

const snapshot = (memMb: number, over: Partial<AppSnapshot> = {}): AppSnapshot => {
  const env = over.env ?? "prod";
  const app = over.app ?? "rest-api";
  return {
    key: `${env}:${app}`,
    app,
    env,
    service: `${app}-service`,
    cpuPct: 1,
    memBytes: memMb * MB,
    memTotalBytes: memMb * MB,
    netRxBps: 0,
    netTxBps: 0,
    time: ago(20),
    ...over,
  };
};

const ctx = (): EnvContext => ({ env: "prod", now: NOW, supabase: {}, registry: {}, probeResults: new Map() }) as unknown as EnvContext;

/** The switch an admin flips on /alerts/rules. */
const WITH_STAGING = { [WATCH_STAGING_RULE_ID]: { enabled: true } };

const rule = (id: string, overrides = {}) => appRules(overrides).find((r) => r.id === id)!;
const evaluate = (id: string, overrides = {}) => rule(id, overrides).evaluate(ctx());

const orgBefore = process.env.INFLUXDB_ORG;
afterAll(() => {
  if (orgBefore === undefined) delete process.env.INFLUXDB_ORG;
  else process.env.INFLUXDB_ORG = orgBefore;
});

describe("app and server rules", () => {
  beforeEach(() => {
    process.env.INFLUXDB_ORG = "streamwizard-prod";
    influxContainers = [];
    influxTasks = [];
    influxSnapshots = [];
    influxServer = null;
    influxLastReports = [{ tagValue: "dokploy", lastSeen: ago(20) }];
    influxOomKills = 0;
    influxReads = 0;
  });

  describe("app.down", () => {
    test("fires when an app's containers are known and none is running", async () => {
      influxContainers = [stopped(90)];
      expect(await evaluate("app.down")).toEqual([
        { entityId: "prod:rest-api", severity: "crit", message: "rest-api (prod) has no running container (the last one exited with code 1)" },
      ]);
    });

    test("a running container Telegraf stopped reporting is gone too", async () => {
      influxContainers = [container({ lastSeen: ago(600) }), container({ app: "ws-server" })];
      expect((await evaluate("app.down")).map((b) => b.entityId)).toEqual(["prod:rest-api"]);
    });

    test("container numbers that lag the server numbers do not read as every app down", async () => {
      // The docker input reports later than the host inputs, and can stall alone.
      influxLastReports = [{ tagValue: "dokploy", lastSeen: ago(100) }];
      influxContainers = [container({ lastSeen: ago(130) }), container({ app: "ws-server", lastSeen: ago(130) })];
      expect(await evaluate("app.down")).toEqual([]);
      influxContainers = [container({ lastSeen: ago(900) }), container({ app: "ws-server", lastSeen: ago(900) })];
      expect(await evaluate("app.down")).toEqual([]);
    });

    test("stays quiet while one container runs, as during a start-first update", async () => {
      influxContainers = [container({ startedAt: ago(30) }), container()];
      expect(await evaluate("app.down")).toEqual([]);
    });

    test("an app that never reported is not down", async () => {
      influxContainers = [container({ app: "ws-server" })];
      expect(await evaluate("app.down")).toEqual([]);
    });

    test("a service scaled to zero is not down", async () => {
      influxContainers = [stopped(90, { app: "obs-auto-switcher", exitCode: 0 })];
      influxTasks = [{ key: "prod:obs-auto-switcher", app: "obs-auto-switcher", env: "prod", service: "s", desired: 0, running: 0, time: ago(20) }];
      expect(await evaluate("app.down")).toEqual([]);
    });

    test("ignores what is not ours", async () => {
      influxContainers = [stopped(90, { env: "other", app: "amrio" })];
      expect(await evaluate("app.down")).toEqual([]);
    });

    test("staging is left out until its switch is on, and then stays at warn", async () => {
      influxContainers = [stopped(90, { env: "staging" }), stopped(90, { env: "shared", app: "traefik" })];
      expect((await evaluate("app.down")).map((b) => [b.entityId, b.severity])).toEqual([["shared:traefik", "crit"]]);
      expect((await evaluate("app.down", WITH_STAGING)).map((b) => [b.entityId, b.severity])).toEqual([
        ["staging:rest-api", "warn"],
        ["shared:traefik", "crit"],
      ]);
    });
  });

  describe("app.crash", () => {
    test("one crash that swarm already replaced fires", async () => {
      influxContainers = [container({ startedAt: ago(50) }), stopped(60, { exitCode: 137 })];
      expect(await evaluate("app.crash")).toEqual([
        { entityId: "prod:rest-api", severity: "crit", value: 1, message: "rest-api (prod) crashed with exit code 137" },
      ]);
    });

    test("a loop reads as one alert with the count", async () => {
      influxContainers = [container({ startedAt: ago(5) }), stopped(10), stopped(120), stopped(300)];
      const [breach] = await evaluate("app.crash");
      expect(breach).toMatchObject({ value: 3, message: "rest-api (prod) crashed 3 times in 10 min, last exit code 1" });
    });

    test("a deploy is not a crash, whatever exit code the old container left", async () => {
      // Start-first: the replacement was up 5 s before the old container ended.
      for (const exitCode of [0, 143, 137]) {
        influxContainers = [
          container({ startedAt: ago(65) }),
          container({ state: "exited", startedAt: ago(3_600), finishedAt: ago(60), exitCode, health: "unhealthy" }),
        ];
        expect(await evaluate("app.crash")).toEqual([]);
      }
    });

    test("a new version that dies on start during a deploy is a crash", async () => {
      // The old container keeps running: nothing younger started before this one ended.
      influxContainers = [stopped(60), container()];
      expect(await evaluate("app.crash")).toHaveLength(1);
    });

    test("a clean stop, an old crash and an OOM kill are left out", async () => {
      influxContainers = [stopped(60, { exitCode: 0 }), stopped(60, { exitCode: 143 }), stopped(11 * 60), stopped(60, { exitCode: 137, oomKilled: true })];
      expect(await evaluate("app.crash")).toEqual([]);
    });

    test("the count can be raised to alert on loops only", async () => {
      influxContainers = [stopped(60)];
      expect(await evaluate("app.crash", { "app.crash": { crit: 2 } })).toEqual([]);
      influxContainers = [stopped(60), stopped(180)];
      expect(await evaluate("app.crash", { "app.crash": { crit: 2 } })).toHaveLength(1);
    });

    test("a staging crash is only seen with the switch on, at warn", async () => {
      influxContainers = [stopped(60, { env: "staging" })];
      expect(await evaluate("app.crash")).toEqual([]);
      expect((await evaluate("app.crash", WITH_STAGING))[0]?.severity).toBe("warn");
    });
  });

  describe("app.oom_kill", () => {
    test("fires for a container killed for memory in the window", async () => {
      influxContainers = [container({ startedAt: ago(50) }), stopped(60, { exitCode: 137, oomKilled: true })];
      expect(await evaluate("app.oom_kill")).toEqual([
        { entityId: "prod:rest-api", severity: "crit", value: 1, message: "rest-api (prod) was killed for running out of memory once in 10 min" },
      ]);
    });

    test("an old kill and an ordinary crash are left out", async () => {
      influxContainers = [stopped(11 * 60, { oomKilled: true }), stopped(60)];
      expect(await evaluate("app.oom_kill")).toEqual([]);
    });
  });

  describe("app.restart_loop", () => {
    test("counts stops with clean exit codes too", async () => {
      influxContainers = [container({ startedAt: ago(5) }), stopped(10, { exitCode: 0 }), stopped(200, { exitCode: 0 }), stopped(500, { exitCode: 143 })];
      expect(await evaluate("app.restart_loop")).toEqual([
        { entityId: "prod:rest-api", severity: "crit", value: 3, message: "rest-api (prod) restarted 3 times in 15 min without a deploy" },
      ]);
    });

    test("two restarts are not a loop yet", async () => {
      influxContainers = [stopped(10, { exitCode: 0 }), stopped(200, { exitCode: 0 })];
      expect(await evaluate("app.restart_loop")).toEqual([]);
    });

    test("deploys in a row are not a loop", async () => {
      // Each new container started 5 s before the one before it ended.
      influxContainers = [
        container({ startedAt: ago(100) }),
        container({ state: "exited", startedAt: ago(300), finishedAt: ago(95), exitCode: 0 }),
        container({ state: "exited", startedAt: ago(500), finishedAt: ago(295), exitCode: 0 }),
        container({ state: "exited", startedAt: ago(700), finishedAt: ago(495), exitCode: 0 }),
      ];
      expect(await evaluate("app.restart_loop")).toEqual([]);
    });
  });

  describe("app.unhealthy", () => {
    test("fires for a running container that fails its healthcheck", async () => {
      influxContainers = [container({ health: "unhealthy", failingStreak: 4 })];
      expect(await evaluate("app.unhealthy")).toEqual([
        { entityId: "prod:rest-api", severity: "crit", value: 4, message: "rest-api (prod) is running but fails its healthcheck (4 checks in a row)" },
      ]);
    });

    test("a stopped container always reads unhealthy and does not count", async () => {
      influxContainers = [container(), stopped(60, { exitCode: 0, health: "unhealthy" })];
      expect(await evaluate("app.unhealthy")).toEqual([]);
    });
  });

  describe("app.memory_high", () => {
    test("warns above 80% of the app's budget, crit above 100%", async () => {
      // rest-api prod: 1024 MB. ws-server prod: 512 MB.
      influxSnapshots = [snapshot(900), snapshot(600, { app: "ws-server" }), snapshot(300, { app: "discord-bot" })];
      const breaches = await evaluate("app.memory_high");
      expect(breaches.map((b) => [b.entityId, b.severity, b.message])).toEqual([
        ["prod:rest-api", "warn", "rest-api (prod) uses 900 MB, 88% of its 1024 MB budget"],
        ["prod:ws-server", "crit", "ws-server (prod) uses 600 MB, 117% of its 512 MB budget"],
      ]);
    });

    test("staging never goes above warn, and an app without a budget is skipped", async () => {
      influxSnapshots = [snapshot(2_000, { env: "staging" }), snapshot(2_000, { env: "shared", app: "dokploy-redis" })];
      expect(await evaluate("app.memory_high")).toEqual([]);
      expect((await evaluate("app.memory_high", WITH_STAGING)).map((b) => [b.entityId, b.severity])).toEqual([["staging:rest-api", "warn"]]);
    });

    test("old numbers of a stopped app are not its current load", async () => {
      influxSnapshots = [snapshot(2_000, { time: ago(200) })];
      expect(await evaluate("app.memory_high")).toEqual([]);
    });

    test("thresholds can be overridden", async () => {
      influxSnapshots = [snapshot(600)];
      expect(await evaluate("app.memory_high")).toEqual([]);
      expect(await evaluate("app.memory_high", { "app.memory_high": { warn: 50 } })).toHaveLength(1);
    });
  });

  describe("server rules", () => {
    test("server.disk_high warns and goes crit on the root disk", async () => {
      influxServer = { host: "dokploy", time: ago(20), diskUsedPct: 85 };
      expect(await evaluate("server.disk_high")).toEqual([
        { entityId: "dokploy", severity: "warn", value: 85, message: "Disk on dokploy at 85% (warn > 80%)" },
      ]);
      influxServer = { host: "dokploy", time: ago(20), diskUsedPct: 93 };
      expect((await evaluate("server.disk_high"))[0]?.severity).toBe("crit");
      influxServer = { host: "dokploy", time: ago(20), diskUsedPct: 28 };
      expect(await evaluate("server.disk_high")).toEqual([]);
    });

    test("server.oom_kill warns when the kernel killed something", async () => {
      expect(await evaluate("server.oom_kill")).toEqual([]);
      influxOomKills = 2;
      expect(await evaluate("server.oom_kill")).toEqual([
        { entityId: "dokploy", severity: "warn", value: 2, message: "dokploy ran out of memory: the kernel killed a process 2 times in 10 min" },
      ]);
    });

    test("server.telegraf_silent fires once the newest reading is older than the knob", async () => {
      influxContainers = [container()];
      influxLastReports = [{ tagValue: "dokploy", lastSeen: ago(170) }];
      expect(await evaluate("server.telegraf_silent")).toEqual([]);
      influxLastReports = [{ tagValue: "dokploy", lastSeen: ago(600) }];
      expect(await evaluate("server.telegraf_silent")).toEqual([
        {
          entityId: "dokploy",
          severity: "crit",
          value: 600,
          message: "Telegraf on dokploy hasn't reported for 10 min: no app or server data, so their alerts are blind",
        },
      ]);
      expect(await evaluate("server.telegraf_silent", { "server.telegraf_silent": { crit: 15 } })).toEqual([]);
    });

    test("a server that never reported is not silent", async () => {
      influxLastReports = [];
      expect(await evaluate("server.telegraf_silent")).toEqual([]);
    });

    test("server.telegraf_silent also fires when only the container numbers stopped", async () => {
      influxContainers = [container({ lastSeen: ago(600) })];
      expect(await evaluate("server.telegraf_silent")).toEqual([
        {
          entityId: "dokploy:containers",
          severity: "crit",
          value: 600,
          message: "Telegraf on dokploy reports the server but no containers for 10 min: the app alerts are blind",
        },
      ]);
      influxContainers = [container()];
      expect(await evaluate("server.telegraf_silent")).toEqual([]);
    });
  });

  test("while Telegraf is silent only server.telegraf_silent fires", async () => {
    influxLastReports = [{ tagValue: "dokploy", lastSeen: ago(600) }];
    influxContainers = [stopped(60), stopped(120, { oomKilled: true }), stopped(200), container({ app: "ws-server", health: "unhealthy" })];
    influxSnapshots = [snapshot(5_000)];
    influxServer = { host: "dokploy", time: ago(600), diskUsedPct: 99 };
    influxOomKills = 3;
    const fired: string[] = [];
    for (const r of appRules({})) if ((await r.evaluate(ctx())).length > 0) fired.push(r.id);
    expect(fired).toEqual(["server.telegraf_silent"]);
  });

  test("outside the prod org nothing is read: the bucket is not there", async () => {
    process.env.INFLUXDB_ORG = "streamwizard-staging";
    influxContainers = [stopped(60)];
    influxLastReports = [{ tagValue: "dokploy", lastSeen: ago(600) }];
    for (const r of appRules({})) expect(await r.evaluate(ctx())).toEqual([]);
    expect(influxReads).toBe(0);
  });

  test("the rules of one tick share their reads", async () => {
    influxContainers = [stopped(60)];
    const tick = ctx();
    for (const id of ["app.down", "app.crash", "app.oom_kill", "app.restart_loop", "app.unhealthy"]) await rule(id).evaluate(tick);
    // Last report, containers, and the task counts app.down asks for.
    expect(influxReads).toBe(3);
  });

  test("the staging switch is a rule that is off by default and never fires", async () => {
    const off = rule(WATCH_STAGING_RULE_ID);
    expect(off.enabled).toBe(false);
    expect(off.meta?.defaultEnabled).toBe(false);
    const on = rule(WATCH_STAGING_RULE_ID, WITH_STAGING);
    expect(on.enabled).toBe(true);
    influxContainers = [stopped(60, { env: "staging" })];
    expect(await on.evaluate(ctx())).toEqual([]);
  });

  test("with staging stopped and its switch off, not one staging alert", async () => {
    // Every staging container gone, old numbers still in the bucket.
    influxContainers = [
      container(),
      ...["rest-api", "ws-server", "web-admin"].flatMap((app) => [stopped(60, { env: "staging", app }), stopped(200, { env: "staging", app, oomKilled: true }), stopped(400, { env: "staging", app })]),
    ];
    influxSnapshots = [snapshot(5_000, { env: "staging" })];
    for (const r of appRules({})) {
      expect((await r.evaluate(ctx())).filter((b) => b.entityId.startsWith("staging:"))).toEqual([]);
    }
  });

  test("every rule runs in prod only, where the data is", () => {
    for (const r of appRules({})) expect(r.envs).toEqual(["prod"]);
  });

  test("notifications name the app before the environment", () => {
    expect(appEntityLabel("prod:rest-api")).toBe("rest-api (prod)");
    expect(appEntityLabel("dokploy")).toBeUndefined();
  });
});
