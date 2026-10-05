import { describe, expect, it } from "bun:test";
import {
  BUCKETS,
  assertAppEnv,
  assertAppName,
  bucketsInOrg,
  buildAppContainersQuery,
  buildAppHistoryQuery,
  buildAppSnapshotQuery,
  buildAppTrafficQuery,
  buildServerHistoryQuery,
  buildServerOomKillsQuery,
  fluxFromAll,
  orgHasBucket,
} from "@repo/metrics";

describe("buckets per org", () => {
  // Only the prod org has the webserver bucket. A union that names a bucket
  // the org lacks fails as a whole, which is what broke meta.pipeline_silent
  // when a bucket was added for one environment only.
  it("gives staging and dev every bucket but the prod-only ones", () => {
    expect(bucketsInOrg("streamwizard-prod")).toContain(BUCKETS.webserver);
    expect(bucketsInOrg("streamwizard-staging")).not.toContain(BUCKETS.webserver);
    expect(bucketsInOrg("streamwizard-dev")).not.toContain(BUCKETS.webserver);
    expect(bucketsInOrg(undefined)).not.toContain(BUCKETS.webserver);
    expect(bucketsInOrg("streamwizard-staging")).toContain(BUCKETS.proxmox);
  });

  it("answers for one bucket", () => {
    expect(orgHasBucket(BUCKETS.webserver, "streamwizard-prod")).toBe(true);
    expect(orgHasBucket(BUCKETS.webserver, "streamwizard-staging")).toBe(false);
    expect(orgHasBucket(BUCKETS.restApi, "streamwizard-staging")).toBe(true);
  });

  it("reads every bucket of the org this process is in, and no other", () => {
    const before = process.env.INFLUXDB_ORG;
    try {
      process.env.INFLUXDB_ORG = "streamwizard-staging";
      expect(fluxFromAll("-5m")).not.toContain('"webserver"');
      process.env.INFLUXDB_ORG = "streamwizard-prod";
      expect(fluxFromAll("-5m")).toContain('from(bucket: "webserver") |> range(start: -5m)');
    } finally {
      if (before === undefined) delete process.env.INFLUXDB_ORG;
      else process.env.INFLUXDB_ORG = before;
    }
  });
});

describe("webserver queries", () => {
  const before = (query: string, first: string, second: string) => {
    expect(query.indexOf(first)).toBeGreaterThan(-1);
    expect(query.indexOf(first)).toBeLessThan(query.indexOf(second));
  };

  it("read the webserver bucket, bounded", () => {
    for (const query of [buildAppSnapshotQuery("5m"), buildAppTrafficQuery("5m"), buildAppContainersQuery("24h"), buildServerOomKillsQuery("24h")]) {
      expect(query).toContain('from(bucket: "webserver") |> range(start: -');
    }
  });

  // health_status is a string and oomkilled a boolean next to numeric fields.
  it("pick their fields before any math", () => {
    before(buildAppSnapshotQuery(), 'r._field == "usage_percent"', "last()");
    before(buildAppSnapshotQuery(), 'r._field == "rx_bytes"', "derivative(");
    before(buildServerHistoryQuery(), 'r._field == "oom_kill"', "difference(");
  });

  // Counters only mean something as a rate.
  it("turn Traefik and network counters into rates before averaging", () => {
    before(buildAppTrafficQuery(), "derivative(unit: 1s, nonNegative: true)", "mean()");
    const history = buildAppHistoryQuery("prod", "rest-api", "24h", "1h");
    before(history.slice(history.indexOf("rates = data")), "derivative(unit: 1s, nonNegative: true)", "aggregateWindow(every: 1h");
  });

  it("never aggregates the container state rows: their fields differ in type", () => {
    const query = buildAppContainersQuery("24h");
    expect(query).toContain("last()");
    expect(query).not.toContain("group(");
    expect(query).not.toContain("pivot(");
  });

  it("scope one app by env and app, since the app tag repeats across environments", () => {
    expect(buildAppHistoryQuery("staging", "rest-api", "24h", "1h")).toContain('r.env == "staging" and r.app == "rest-api"');
    expect(buildAppContainersQuery("24h", "prod", "web-overlay")).toContain('r.env == "prod" and r.app == "web-overlay"');
  });

  it("refuse values that would change the Flux source", () => {
    expect(() => assertAppName('x" or true or r.app == "')).toThrow();
    expect(() => assertAppName("")).toThrow();
    expect(() => assertAppEnv("production")).toThrow();
    expect(() => buildAppHistoryQuery("prod", 'a") |> drop()', "24h", "1h")).toThrow();
    expect(() => buildAppHistoryQuery("prod", "rest-api", "24h); drop", "1h")).toThrow();
    expect(() => buildAppSnapshotQuery("5m |> yield()")).toThrow();
    expect(assertAppName("streamwizard-restapi-13udoq")).toBe("streamwizard-restapi-13udoq");
  });
});
