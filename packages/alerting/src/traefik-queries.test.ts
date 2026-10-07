import { describe, expect, it } from "bun:test";
import {
  assertTraefikScope,
  buildTraefikAppsQuery,
  buildTraefikHistoryQuery,
  buildTraefikProxyHistoryQuery,
  buildTraefikProxySnapshotQuery,
  buildTraefikSparklinesQuery,
  buildTraefikStatusCountsQuery,
  emptyRates,
  meanMs,
  sharePct,
  slowPct,
  speedBandLabels,
  speedBands,
  statusClass,
  totalRates,
} from "@repo/metrics";

describe("traefik queries", () => {
  const before = (query: string, first: string, second: string) => {
    expect(query.indexOf(first)).toBeGreaterThan(-1);
    expect(query.indexOf(first)).toBeLessThan(query.indexOf(second));
  };

  const all = () => [
    buildTraefikAppsQuery("5m"),
    buildTraefikSparklinesQuery("1h", "5m"),
    buildTraefikHistoryQuery("prod", "24h", "1h"),
    buildTraefikStatusCountsQuery("all", "24h"),
    buildTraefikProxyHistoryQuery("24h", "1h"),
    buildTraefikProxySnapshotQuery("5m"),
  ];

  it("read the webserver bucket, bounded", () => {
    for (const query of all()) expect(query).toContain('from(bucket: "webserver") |> range(start: -');
  });

  // Every traefik field but open_connections is a counter since Traefik started.
  it("turn the counters into rates before averaging or summing", () => {
    before(buildTraefikAppsQuery(), "derivative(unit: 1s, nonNegative: true)", "mean()");
    before(buildTraefikSparklinesQuery("1h", "5m"), "derivative(unit: 1s, nonNegative: true)", "aggregateWindow(every: 5m");
    before(buildTraefikHistoryQuery("all", "24h", "1h"), "derivative(unit: 1s, nonNegative: true)", "aggregateWindow(every: 1h");
    const proxy = buildTraefikProxyHistoryQuery("24h", "1h");
    before(proxy.slice(proxy.indexOf("entrypoints = data")), "derivative(unit: 1s, nonNegative: true)", "aggregateWindow(every: 1h");
    before(buildTraefikStatusCountsQuery("all"), "difference(nonNegative: true)", "sum()");
  });

  it("leave the open connections as they are: a gauge", () => {
    const proxy = buildTraefikProxyHistoryQuery("24h", "1h");
    const connections = proxy.slice(proxy.indexOf("connections = data"), proxy.indexOf("entrypoints = data"));
    expect(connections).toContain('r._field == "traefik_open_connections"');
    expect(connections).not.toContain("derivative(");
    expect(buildTraefikProxySnapshotQuery()).not.toContain("derivative(");
  });

  // A filter that only sits on the branches makes InfluxDB read the whole
  // bucket first.
  it("pick their fields before the first calculation", () => {
    for (const query of [buildTraefikAppsQuery(), buildTraefikSparklinesQuery(), buildTraefikHistoryQuery("all"), buildTraefikProxyHistoryQuery()]) {
      before(query, 'r._measurement == "traefik"', "derivative(");
    }
    before(buildTraefikStatusCountsQuery("all"), 'r._measurement == "traefik"', "difference(");
    before(buildTraefikProxySnapshotQuery(), 'r._measurement == "traefik"', "last()");
    before(buildTraefikProxyHistoryQuery(), 'r._field == "traefik_open_connections" or r._field == "traefik_entrypoint_requests_total"', "connections = data");
  });

  // A WebSocket stays open for minutes and would count as a slow request.
  it("count only HTTP in the speed histogram", () => {
    const histogram = '(r._measurement == "traefik" and (r._field == "traefik_service_request_duration_seconds_bucket")) and r.protocol == "http"';
    expect(buildTraefikAppsQuery()).toContain(histogram);
    expect(buildTraefikHistoryQuery("prod")).toContain(histogram);
  });

  it("add the series up inside Flux, so a poll returns a few rows", () => {
    const history = buildTraefikHistoryQuery("all", "24h", "1h");
    expect(history).toContain('group(columns: ["_time", "_field", "code", "protocol"])');
    expect(history).toContain('group(columns: ["_time", "_field", "le"])');
    expect(buildTraefikSparklinesQuery()).toContain('group(columns: ["_time", "app", "env"])');
    expect(buildTraefikStatusCountsQuery("all")).toContain('group(columns: ["app", "env", "code"])');
  });

  it("scope by environment, or take every series that belongs to an app", () => {
    expect(buildTraefikHistoryQuery("staging")).toContain('r.env == "staging"');
    expect(buildTraefikHistoryQuery("all")).toContain("exists r.app and exists r.env");
    expect(buildTraefikStatusCountsQuery("other")).toContain('r.env == "other"');
  });

  it("refuse values that would change the Flux source", () => {
    expect(() => assertTraefikScope("production")).toThrow();
    expect(() => buildTraefikHistoryQuery('prod" or true or r.env == "', "24h", "1h")).toThrow();
    expect(() => buildTraefikHistoryQuery("prod", "24h); drop", "1h")).toThrow();
    expect(() => buildTraefikHistoryQuery("prod", "24h", "1h |> yield()")).toThrow();
    expect(() => buildTraefikStatusCountsQuery("all", "5m |> yield()")).toThrow();
    expect(() => buildTraefikSparklinesQuery("1h", "x")).toThrow();
    expect(() => buildTraefikProxyHistoryQuery("24h", "1h)")).toThrow();
    expect(assertTraefikScope("all")).toBe("all");
  });
});

describe("traefik maths", () => {
  // Traefik's default steps, cumulative: "within 0.3 s" includes "within 0.1 s".
  const within = { "0.1": 60, "0.3": 80, "1.2": 95, "5": 99, "+Inf": 100 };

  it("names the speed bands from the histogram steps, fastest first", () => {
    expect(speedBandLabels(["+Inf", "5", "0.1", "1.2", "0.3"])).toEqual(["Under 0.1 s", "0.1 to 0.3 s", "0.3 to 1.2 s", "1.2 to 5 s", "Over 5 s"]);
    expect(speedBandLabels([])).toEqual([]);
  });

  it("turns the cumulative histogram into a share per band", () => {
    const bands = speedBands(within);
    expect(bands.map((b) => b.label)).toEqual(["Under 0.1 s", "0.1 to 0.3 s", "0.3 to 1.2 s", "1.2 to 5 s", "Over 5 s"]);
    expect(bands.map((b) => Math.round(b.share))).toEqual([60, 20, 15, 4, 1]);
  });

  it("has no bands without requests", () => {
    expect(speedBands({})).toEqual([]);
    expect(speedBands({ "0.1": 0, "+Inf": 0 })).toEqual([]);
  });

  // The steps are averaged rates per series: they can disagree by a hair.
  it("never reports a negative band or more than the total", () => {
    const bands = speedBands({ "0.1": 50, "0.3": 49.9, "1.2": 101, "5": 100, "+Inf": 100 });
    expect(bands.every((b) => b.share >= 0)).toBe(true);
    expect(Math.round(bands.reduce((sum, b) => sum + b.share, 0))).toBe(100);
  });

  it("counts a request as slow past 1.2 s", () => {
    expect(slowPct(within)).toBeCloseTo(5);
    expect(slowPct({ "0.1": 10, "+Inf": 10 })).toBeNull();
    expect(slowPct({})).toBeNull();
    expect(slowPct({ "1.2": 12, "+Inf": 10 })).toBe(0);
  });

  it("sorts status codes into classes", () => {
    expect(statusClass("200")).toBe("2xx");
    expect(statusClass("404")).toBe("4xx");
    expect(statusClass("502")).toBe("5xx");
    // Traefik reports a hijacked WebSocket as code 0.
    expect(statusClass("0")).toBe("other");
    expect(statusClass(undefined)).toBe("other");
  });

  it("adds rows up before it takes a share, so a busy app weighs more", () => {
    const quiet = { ...emptyRates(), requestsPerSec: 1, serverErrorsPerSec: 1, durationPerSec: 2, timedPerSec: 1, httpWithin: { "1.2": 0, "+Inf": 1 } };
    const busy = { ...emptyRates(), requestsPerSec: 99, durationPerSec: 9.9, timedPerSec: 99, httpWithin: { "1.2": 99, "+Inf": 99 } };
    const total = totalRates([quiet, busy]);
    expect(sharePct(total.serverErrorsPerSec, total.requestsPerSec)).toBeCloseTo(1);
    expect(meanMs(total)).toBeCloseTo(119);
    expect(slowPct(total.httpWithin)).toBeCloseTo(1);
    expect(sharePct(0, 0)).toBeNull();
    expect(meanMs(emptyRates())).toBeNull();
  });
});
