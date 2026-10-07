import { describe, expect, test } from "bun:test";
import type { TraefikAppStats, TraefikStatusCount } from "@repo/metrics/traefik-model";
import { buildErrorRows, buildTraefikRows, parseScope, scopeTotals, statusMeaning } from "./traefik-model";

const EMPTY = { requestsPerSec: 0, clientErrorsPerSec: 0, serverErrorsPerSec: 0, bytesInPerSec: 0, bytesOutPerSec: 0, durationPerSec: 0, timedPerSec: 0, httpWithin: {} };

function app(env: string, name: string, overrides: Partial<TraefikAppStats> = {}): TraefikAppStats {
  return { ...EMPTY, key: `${env}:${name}`, app: name, env, ...overrides };
}

const stats = [
  app("prod", "rest-api", { requestsPerSec: 90, clientErrorsPerSec: 9, bytesOutPerSec: 1000, durationPerSec: 9, timedPerSec: 90, httpWithin: { "1.2": 90, "+Inf": 90 } }),
  app("prod", "web-overlay", { requestsPerSec: 10, serverErrorsPerSec: 5, bytesOutPerSec: 500, durationPerSec: 20, timedPerSec: 10, httpWithin: { "1.2": 5, "+Inf": 10 } }),
  app("staging", "rest-api", { requestsPerSec: 1 }),
  app("other", "someone-else", { requestsPerSec: 4, serverErrorsPerSec: 4 }),
];

describe("scope", () => {
  test("anything that is not a scope opens production", () => {
    expect(parseScope("staging")).toBe("staging");
    expect(parseScope("all")).toBe("all");
    expect(parseScope(undefined)).toBe("prod");
    expect(parseScope("production")).toBe("prod");
    expect(parseScope(["staging", "prod"])).toBe("prod");
  });
});

describe("totals of a scope", () => {
  test("add the apps up first, then take the shares", () => {
    const totals = scopeTotals(stats, "prod");
    expect(totals.requestsPerSec).toBe(100);
    // 5 of 100, not the mean of 0% and 50%.
    expect(totals.serverErrorPct).toBeCloseTo(5);
    expect(totals.clientErrorPct).toBeCloseTo(9);
    expect(totals.slowPct).toBeCloseTo(5);
    expect(totals.meanMs).toBeCloseTo(290);
    expect(totals.bytesOutPerSec).toBe(1500);
  });

  test("leave other environments out, and take all of them for 'all'", () => {
    expect(scopeTotals(stats, "staging").requestsPerSec).toBe(1);
    expect(scopeTotals(stats, "all").requestsPerSec).toBe(105);
  });

  test("have no share without requests", () => {
    const totals = scopeTotals(stats, "shared");
    expect(totals.requestsPerSec).toBe(0);
    expect(totals.serverErrorPct).toBeNull();
    expect(totals.slowPct).toBeNull();
    expect(totals.meanMs).toBeNull();
  });
});

describe("app rows", () => {
  test("keep to the scope and put the app with trouble first", () => {
    const rows = buildTraefikRows(stats, [{ key: "prod:rest-api", requests: [1, 2, 3] }], "prod");
    expect(rows.map((r) => r.app)).toEqual(["web-overlay", "rest-api"]);
    expect(rows[0]!.serverErrorPct).toBeCloseTo(50);
    expect(rows[1]!.sparkline).toEqual([1, 2, 3]);
    expect(rows[0]!.sparkline).toEqual([]);
  });

  test("sort slow before busy when nothing fails", () => {
    const rows = buildTraefikRows(
      [app("prod", "busy", { requestsPerSec: 50, httpWithin: { "1.2": 50, "+Inf": 50 } }), app("prod", "slow", { requestsPerSec: 2, httpWithin: { "1.2": 1, "+Inf": 2 } }), app("prod", "idle")],
      [],
      "prod",
    );
    expect(rows.map((r) => r.app)).toEqual(["slow", "busy", "idle"]);
  });

  // 100% errors on a neighbour's app is not our problem to open the list with.
  test("never let the rest of the server lead the list", () => {
    const rows = buildTraefikRows(stats, [], "all");
    expect(rows.at(-1)!.app).toBe("someone-else");
    expect(rows[0]!.app).toBe("web-overlay");
  });
});

describe("error rows", () => {
  const counts: TraefikStatusCount[] = [
    { key: "prod:rest-api", app: "rest-api", env: "prod", code: "200", count: 900 },
    { key: "prod:rest-api", app: "rest-api", env: "prod", code: "404", count: 90 },
    { key: "prod:rest-api", app: "rest-api", env: "prod", code: "502", count: 10 },
    { key: "prod:ws-server", app: "ws-server", env: "prod", code: "0", count: 40 },
    { key: "prod:ws-server", app: "ws-server", env: "prod", code: "500", count: 0.2 },
  ];

  test("list 4xx and 5xx only, most frequent first, as a share of the app's answers", () => {
    const rows = buildErrorRows(counts);
    expect(rows.map((r) => `${r.app} ${r.code}`)).toEqual(["rest-api 404", "rest-api 502"]);
    expect(rows[0]!.sharePct).toBeCloseTo(9);
    expect(rows[1]!.sharePct).toBeCloseTo(1);
  });

  test("stop at the limit", () => {
    expect(buildErrorRows(counts, 1)).toHaveLength(1);
  });

  test("say what the common codes mean, and nothing for the rare ones", () => {
    expect(statusMeaning("502")).toBe("App did not answer");
    expect(statusMeaning("418")).toBe("");
  });
});
