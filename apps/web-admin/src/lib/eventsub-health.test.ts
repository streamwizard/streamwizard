import { describe, expect, test } from "bun:test";
import type { EventsubShardHeartbeatRow } from "@repo/metrics";
import { buildEventsubChecks, buildKpis, buildShardViews, byWorstFirst, padShardThroughput, summarize } from "./eventsub-health";
import type { EventsubMetrics, HelixShard } from "./eventsub-metrics";

const NOW = "2026-09-28T12:00:00.000Z";
const secAgo = (s: number) => new Date(Date.parse(NOW) - s * 1000).toISOString();

function hb(shardId: string, overrides: Partial<EventsubShardHeartbeatRow> = {}): EventsubShardHeartbeatRow {
  return {
    service: "streamwizard-bot",
    shardId,
    time: secAgo(10),
    connected: true,
    stateCode: 3,
    messages: 10,
    notifications: 6,
    lastMessageAgeMs: 2000,
    reconnectAttempts: 0,
    sessionAgeS: 600,
    conduitMissing: false,
    sessionId: `s${shardId}`,
    ...overrides,
  };
}

function helix(id: string, status: HelixShard["status"] = "enabled"): HelixShard {
  return { id, status, sessionId: `s${id}`, connectedAt: secAgo(600), disconnectedAt: null };
}

function metrics(overrides: Partial<EventsubMetrics> = {}): EventsubMetrics {
  return {
    generatedAt: NOW,
    helixConfigured: true,
    errors: { helix: false, subscriptions: false, influx: false, lifecycle: false },
    conduit: { id: "c1", shardCount: 2, shards: [helix("0"), helix("1")] },
    conduitMissing: false,
    subscriptions: { total: 100, totalCost: 2, maxTotalCost: 10000, byStatus: { enabled: 100 }, types: [], partial: false, scannedAt: NOW },
    heartbeats: [hb("0"), hb("1")],
    shardThroughput: [],
    eventsByType: [],
    typeTotals: [],
    transport: [{ time: secAgo(120), key: "websocket", count: 4 }],
    connectionCounts: [],
    revocations: [],
    lifecycle: [],
    webhookTypes: [],
    conduitTypes: [],
    ...overrides,
  };
}

describe("buildShardViews", () => {
  test("healthy shards are connected", () => {
    const views = buildShardViews(metrics());
    expect(views.map((v) => [v.id, v.status, v.label])).toEqual([
      ["0", "ok", "Connected"],
      ["1", "ok", "Connected"],
    ]);
    expect(views[0]?.eventsPerMin).toBe(12);
  });

  test("a stale heartbeat means the process is gone", () => {
    const views = buildShardViews(metrics({ heartbeats: [hb("0"), hb("1", { time: secAgo(600) })] }));
    expect(views[1]).toMatchObject({ status: "crit", label: "No heartbeat", eventsPerMin: null, stale: true });
  });

  test("a shard in Helix that no process runs is 'Not running'", () => {
    const views = buildShardViews(metrics({ heartbeats: [hb("0")], conduit: { id: "c1", shardCount: 2, shards: [helix("0"), helix("1", "websocket_disconnected")] } }));
    expect(views[1]).toMatchObject({ status: "warn", label: "Not running" });
  });

  test("bot connected but Helix disabled is a mismatch", () => {
    const views = buildShardViews(metrics({ conduit: { id: "c1", shardCount: 2, shards: [helix("0"), helix("1", "websocket_disconnected")] } }));
    expect(views[1]).toMatchObject({ status: "warn", label: "Mismatch" });
  });

  test("reconnecting is crit only when Helix also has it disabled", () => {
    const reconnecting = hb("1", { stateCode: 2, connected: false, reconnectAttempts: 3 });
    const both = buildShardViews(metrics({ heartbeats: [hb("0"), reconnecting], conduit: { id: "c1", shardCount: 2, shards: [helix("0"), helix("1", "websocket_disconnected")] } }));
    expect(both[1]).toMatchObject({ status: "crit", label: "Reconnecting" });
    const botOnly = buildShardViews(metrics({ heartbeats: [hb("0"), reconnecting] }));
    expect(botOnly[1]?.status).toBe("warn");
  });

  test("without Helix the heartbeats alone decide", () => {
    const views = buildShardViews(metrics({ helixConfigured: false, conduit: null }));
    expect(views.every((v) => v.status === "ok")).toBe(true);
  });

  test("sorting puts the worst shard first", () => {
    const views = buildShardViews(metrics({ heartbeats: [hb("0"), hb("1", { time: secAgo(600) })] })).sort(byWorstFirst);
    expect(views[0]?.id).toBe("1");
  });
});

describe("buildEventsubChecks", () => {
  test("all green when everything is fine", () => {
    const m = metrics();
    const summary = summarize(buildEventsubChecks(m, buildShardViews(m)));
    expect(summary.label).toBe("Healthy");
    expect(summary.failing).toEqual([]);
  });

  test("names each failing check", () => {
    const m = metrics({
      heartbeats: [hb("0"), hb("1", { time: secAgo(600) })],
      revocations: [{ eventType: "channel.follow", transport: "websocket", count: 2 }],
      subscriptions: { total: 100, totalCost: 9000, maxTotalCost: 10000, byStatus: { enabled: 100 }, types: [], partial: false, scannedAt: NOW },
    });
    const summary = summarize(buildEventsubChecks(m, buildShardViews(m)));
    expect(summary.status).toBe("crit");
    expect(summary.failing.map((c) => c.id).sort()).toEqual(["cost", "heartbeat", "revocations", "shards"]);
  });

  test("flags conduit shards that no process runs", () => {
    const m = metrics({ heartbeats: [hb("0")], conduit: { id: "c1", shardCount: 3, shards: [helix("0"), helix("1", "websocket_disconnected"), helix("2", "websocket_disconnected")] } });
    const unrun = buildEventsubChecks(m, buildShardViews(m)).find((c) => c.id === "unrun");
    expect(unrun).toMatchObject({ status: "warn", value: "2" });
  });

  test("a missing conduit is critical", () => {
    const m = metrics({ conduit: null, conduitMissing: true });
    expect(buildEventsubChecks(m, buildShardViews(m)).find((c) => c.id === "conduit")?.status).toBe("crit");
  });

  test("no data at all reads as no data, not healthy", () => {
    const m = metrics({ helixConfigured: false, conduit: null, subscriptions: null, heartbeats: [], transport: [], errors: { helix: false, subscriptions: false, influx: true, lifecycle: false } });
    const checks = buildEventsubChecks(m, buildShardViews(m)).filter((c) => c.id !== "sources");
    expect(summarize(checks).label).toBe("No data yet");
  });
});

describe("buildKpis", () => {
  test("sums rates and counts", () => {
    const m = metrics({
      connectionCounts: [
        { service: "streamwizard-bot", shardId: "0", event: "lost", count: 2 },
        { service: "streamwizard-bot", shardId: "1", event: "lost", count: 1 },
        { service: "streamwizard-bot", shardId: "1", event: "connected", count: 5 },
      ],
    });
    const kpis = buildKpis(m, buildShardViews(m));
    expect(kpis).toMatchObject({ shardsUp: "2 / 2", eventsPerMin: 24, subscriptionsEnabled: 100, subscriptionsTotal: 100, costPct: 0.02, reconnects24h: 3 });
  });
});

describe("padShardThroughput", () => {
  test("fills every 5-minute bucket of the 6h range and leaves missing ones null", () => {
    const padded = padShardThroughput(
      [
        { time: "2026-09-28T11:55:00Z", key: "0", count: 4 },
        // Flux stamps the newest, still-open window with "now"
        { time: NOW, key: "0", count: 2 },
      ],
      ["0", "1"],
      NOW,
    );
    const shard0 = padded.get("0")!;
    expect(shard0).toHaveLength(72);
    expect(shard0.at(-1)).toEqual({ time: "2026-09-28T12:00:00.000Z", key: "0", count: 2 });
    expect(shard0.at(-2)?.count).toBe(4);
    expect(shard0.at(-3)?.count).toBeNull();
    // a shard with no heartbeats at all is one long gap
    expect(padded.get("1")!.every((p) => p.count === null)).toBe(true);
  });
});
