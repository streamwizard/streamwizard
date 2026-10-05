import { describe, expect, test } from "bun:test";
import type { AppContainer, AppSnapshot, AppTraffic } from "@repo/metrics";
import { buildAppRows, hasNoAppData, healthOf, isFailedExit, restartStats, rowsOf, type AppEnv } from "./apps-model";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

function container(over: Partial<AppContainer> = {}): AppContainer {
  return {
    key: "prod:rest-api",
    app: "rest-api",
    env: "prod",
    service: "streamwizard-restapi-13udoq",
    name: "streamwizard-restapi-13udoq.1.aaa",
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

const stopped = (over: Partial<AppContainer> = {}) =>
  container({ state: "exited", health: null, startedAt: ago(7200), finishedAt: ago(3600), lastSeen: ago(20), name: `old-${Math.random()}`, ...over });

function snapshot(over: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    key: "prod:rest-api",
    app: "rest-api",
    env: "prod",
    service: "streamwizard-restapi-13udoq",
    cpuPct: 4,
    memBytes: 150e6,
    memTotalBytes: 200e6,
    netRxBps: 1000,
    netTxBps: 2000,
    time: ago(20),
    ...over,
  };
}

const EXPECTED: { env: AppEnv; app: string }[] = [
  { env: "prod", app: "rest-api" },
  { env: "prod", app: "ws-server" },
  { env: "staging", app: "rest-api" },
];

const build = (data: Partial<Parameters<typeof buildAppRows>[0]>) =>
  buildAppRows({ snapshot: [], containers: [], traffic: [], sparklines: [], ...data }, NOW, EXPECTED);

describe("isFailedExit", () => {
  test("a deploy stops the old container with 143, a clean stop is 0: neither failed", () => {
    expect(isFailedExit({ state: "exited", exitCode: 143, oomKilled: false })).toBe(false);
    expect(isFailedExit({ state: "exited", exitCode: 0, oomKilled: false })).toBe(false);
  });

  test("any other exit code, or an OOM kill, failed", () => {
    expect(isFailedExit({ state: "exited", exitCode: 1, oomKilled: false })).toBe(true);
    expect(isFailedExit({ state: "exited", exitCode: 137, oomKilled: true })).toBe(true);
    expect(isFailedExit({ state: "exited", exitCode: 0, oomKilled: true })).toBe(true);
  });

  test("a running container has not failed, whatever its last exit code says", () => {
    expect(isFailedExit({ state: "running", exitCode: 1, oomKilled: false })).toBe(false);
  });
});

describe("healthOf", () => {
  test("takes the healthcheck of the running container", () => {
    expect(healthOf([container()], true, NOW)).toBe("healthy");
    expect(healthOf([container({ health: "unhealthy" })], true, NOW)).toBe("unhealthy");
  });

  test("running without a healthcheck is plain running", () => {
    expect(healthOf([container({ health: null })], true, NOW)).toBe("running");
  });

  test("a start-first deploy shows the new task starting next to the healthy old one", () => {
    expect(healthOf([container(), container({ name: "new", health: "starting" })], true, NOW)).toBe("starting");
  });

  test("stopped earlier tasks do not count", () => {
    expect(healthOf([container(), stopped({ health: "unhealthy" })], true, NOW)).toBe("healthy");
  });

  test("known containers, none running: stopped", () => {
    expect(healthOf([stopped()], false, NOW)).toBe("stopped");
  });

  test("a container last reported as running long ago is gone, not running", () => {
    expect(healthOf([container({ lastSeen: ago(600) })], false, NOW)).toBe("stopped");
  });

  test("nothing known at all: no data", () => {
    expect(healthOf([], false, NOW)).toBe("nodata");
  });

  test("live numbers without the container list (that read failed): running", () => {
    expect(healthOf([], true, NOW)).toBe("running");
  });
});

describe("restartStats", () => {
  test("a deploy is one start and no failure", () => {
    const stats = restartStats([container({ startedAt: ago(600) }), stopped({ exitCode: 143, startedAt: ago(3 * 86_400), finishedAt: ago(590) })], NOW);
    expect(stats).toEqual({ starts: 1, failed: 0, oomKills: 0 });
  });

  test("a crash loop counts every start and every failed stop", () => {
    const stats = restartStats(
      [
        container({ startedAt: ago(60) }),
        stopped({ exitCode: 1, startedAt: ago(200), finishedAt: ago(70) }),
        stopped({ exitCode: 137, oomKilled: true, startedAt: ago(400), finishedAt: ago(210) }),
      ],
      NOW,
    );
    expect(stats).toEqual({ starts: 3, failed: 2, oomKills: 1 });
  });

  test("starts and stops older than 24 hours are left out", () => {
    const stats = restartStats([container(), stopped({ exitCode: 1, startedAt: ago(3 * 86_400), finishedAt: ago(2 * 86_400) })], NOW);
    expect(stats).toEqual({ starts: 0, failed: 0, oomKills: 0 });
  });
});

describe("buildAppRows", () => {
  test("an expected app without any data keeps its row", () => {
    const rows = build({ snapshot: [snapshot()], containers: [container()] });
    const ws = rows.find((r) => r.key === "prod:ws-server")!;
    expect(ws).toMatchObject({ expected: true, health: "nodata", cpuPct: null, memBytes: null, starts: 0, requestsPerSec: null });
  });

  test("the same app in two environments is two rows", () => {
    const rows = build({ snapshot: [snapshot(), snapshot({ key: "staging:rest-api", env: "staging", cpuPct: 1 })] });
    expect(rows.find((r) => r.key === "prod:rest-api")!.cpuPct).toBe(4);
    expect(rows.find((r) => r.key === "staging:rest-api")!.cpuPct).toBe(1);
  });

  test("joins requests on app + env", () => {
    const traffic: AppTraffic[] = [{ key: "prod:rest-api", app: "rest-api", env: "prod", requestsPerSec: 12, errorPct: 0.5, meanMs: 40 }];
    const row = build({ snapshot: [snapshot()], traffic }).find((r) => r.key === "prod:rest-api")!;
    expect(row).toMatchObject({ requestsPerSec: 12, errorPct: 0.5, meanMs: 40 });
  });

  test("a failed read leaves its columns blank and the row in place", () => {
    // Live numbers read failed; containers and requests answered.
    const traffic: AppTraffic[] = [{ key: "prod:rest-api", app: "rest-api", env: "prod", requestsPerSec: 12, errorPct: 0, meanMs: 40 }];
    const row = build({ containers: [container()], traffic }).find((r) => r.key === "prod:rest-api")!;
    expect(row).toMatchObject({ health: "healthy", cpuPct: null, memBytes: null, requestsPerSec: 12 });
  });

  test("anything Telegraf reports that is not expected becomes a row of its own env", () => {
    const rows = build({
      snapshot: [snapshot({ key: "other:amrio-web", app: "amrio-web", env: "other" }), snapshot({ key: "prod:new-app", app: "new-app" })],
    });
    expect(rows.find((r) => r.key === "other:amrio-web")).toMatchObject({ env: "other", expected: false });
    expect(rows.find((r) => r.key === "prod:new-app")).toMatchObject({ env: "prod", expected: false });
  });

  test("requests alone do not create a row", () => {
    const traffic: AppTraffic[] = [{ key: "other:somewhere", app: "somewhere", env: "other", requestsPerSec: 1, errorPct: 100, meanMs: null }];
    expect(build({ traffic }).some((r) => r.key === "other:somewhere")).toBe(false);
  });

  test("a stopped app shows no load from its last reading", () => {
    const row = build({ snapshot: [snapshot({ time: ago(100) })], containers: [stopped()] }).find((r) => r.key === "prod:rest-api")!;
    expect(row).toMatchObject({ health: "stopped", cpuPct: null, memBytes: null });
  });

  test("when Telegraf went quiet, rows keep their last state and are marked old", () => {
    const row = build({ snapshot: [snapshot({ time: ago(900) })], containers: [container({ lastSeen: ago(900) })] }).find((r) => r.key === "prod:rest-api")!;
    expect(row).toMatchObject({ health: "healthy", stale: true, cpuPct: 4 });
  });
});

describe("rowsOf", () => {
  test("keeps the expected order and puts extras after, by name", () => {
    const rows = build({ snapshot: [snapshot({ key: "prod:zeta", app: "zeta" }), snapshot({ key: "prod:alpha", app: "alpha" })] });
    expect(rowsOf(rows, "prod", EXPECTED).map((r) => r.app)).toEqual(["rest-api", "ws-server", "alpha", "zeta"]);
    expect(rowsOf(rows, "staging", EXPECTED).map((r) => r.app)).toEqual(["rest-api"]);
    expect(rowsOf(rows, "other", EXPECTED)).toEqual([]);
  });
});

describe("hasNoAppData", () => {
  test("true only when no source said anything", () => {
    expect(hasNoAppData(build({}))).toBe(true);
    expect(hasNoAppData(build({ snapshot: [snapshot()] }))).toBe(false);
  });
});
