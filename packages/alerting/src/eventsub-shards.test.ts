import { describe, expect, test } from "bun:test";
import type { EventsubConnectionLatest, EventsubShardLatest } from "@repo/metrics";
import { disconnectedBreaches, heartbeatStaleBreaches, shardsDegradedBreaches } from "./rules/eventsub-shards";
import { getRuleCatalog } from "./rules";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function conn(shardId: string, event: string, minutesAgo: number, service = "streamwizard-bot"): EventsubConnectionLatest {
  return { service, shardId, event, time: minAgo(minutesAgo) };
}

function beat(shardId: string, connected: boolean, minutesAgo: number, service = "streamwizard-bot"): EventsubShardLatest {
  return { service, shardId, connected, time: minAgo(minutesAgo) };
}

describe("eventsub.disconnected per shard", () => {
  test("only the shard that is down alerts, keyed service#shard", () => {
    const breaches = disconnectedBreaches(
      [
        conn("0", "connected", 30),
        conn("1", "connected", 60),
        conn("1", "lost", 5),
        conn("1", "reconnect_attempt", 0.1),
      ],
      NOW,
      2,
      1440,
      3,
    );
    expect(breaches.map((b) => b.entityId)).toEqual(["streamwizard-bot#1"]);
    expect(breaches[0]?.message).toContain("shard 1");
    expect(breaches[0]?.message).toContain("5m");
  });

  test("a healthy shard does not hide a down one on the same service", () => {
    // Before shard tags, both collapsed into one service row and shard 0's
    // newer connected point masked shard 1's outage.
    const breaches = disconnectedBreaches(
      [conn("1", "lost", 10), conn("1", "reconnect_attempt", 0.2), conn("0", "connected", 0.5)],
      NOW,
      2,
      1440,
      3,
    );
    expect(breaches.map((b) => b.entityId)).toEqual(["streamwizard-bot#1"]);
  });

  test("short blips stay under the threshold", () => {
    expect(disconnectedBreaches([conn("0", "lost", 1), conn("0", "reconnect_attempt", 0.1)], NOW, 2, 1440, 3)).toEqual([]);
  });

  test("points without a shard tag count as shard 0", () => {
    const breaches = disconnectedBreaches([{ service: "streamwizard-bot", shardId: "", event: "lost", time: minAgo(5) }], NOW, 2, 1440, 3);
    expect(breaches[0]?.entityId).toBe("streamwizard-bot#0");
  });

  test("many shards down together fold into one alert", () => {
    const rows = ["0", "1", "2", "3"].flatMap((id) => [conn(id, "lost", 4 + Number(id)), conn(id, "reconnect_attempt", 0.1)]);
    const breaches = disconnectedBreaches(rows, NOW, 2, 1440, 3);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]?.entityId).toBe("streamwizard-bot#*");
    expect(breaches[0]?.value).toBe(4);
    expect(breaches[0]?.message).toContain("7m");
  });
});

describe("eventsub.heartbeat_stale", () => {
  test("flags each shard whose heartbeats stopped, even while others keep writing", () => {
    const breaches = heartbeatStaleBreaches([beat("0", true, 0.5), beat("1", true, 10), beat("2", false, 0.2)], NOW, 3);
    expect(breaches.map((b) => b.entityId)).toEqual(["streamwizard-bot#1"]);
    expect(breaches[0]?.severity).toBe("crit");
  });

  test("a fresh heartbeat reporting disconnected is not stale", () => {
    expect(heartbeatStaleBreaches([beat("0", false, 1)], NOW, 3)).toEqual([]);
  });
});

describe("eventsub.shards_degraded", () => {
  test("warns once when enough of a service's shards are down", () => {
    const rows = [beat("0", false, 0.5), beat("1", false, 0.5), beat("2", true, 0.5), beat("3", true, 0.5)];
    const breaches = shardsDegradedBreaches(rows, NOW, 25, 3, 2);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]?.value).toBe(50);
    expect(breaches[0]?.message).toContain("2 of 4");
  });

  test("stays quiet below the share", () => {
    const rows = ["0", "1", "2", "3", "4"].map((id) => beat(id, id !== "0", 0.5));
    expect(shardsDegradedBreaches(rows, NOW, 25, 3, 2)).toEqual([]);
  });

  test("ignores a single-shard setup and stale shards", () => {
    expect(shardsDegradedBreaches([beat("0", false, 0.5)], NOW, 25, 3, 2)).toEqual([]);
    // shard 1 is stale: that's the heartbeat rule's job, and it doesn't count toward the total
    expect(shardsDegradedBreaches([beat("0", true, 0.5), beat("1", false, 10)], NOW, 25, 3, 2)).toEqual([]);
  });
});

describe("eventsub shard rules in the catalog", () => {
  test("ship in the EventSub group", () => {
    const catalog = getRuleCatalog();
    expect(catalog.find((r) => r.id === "eventsub.heartbeat_stale")?.crit?.default).toBe(3);
    expect(catalog.find((r) => r.id === "eventsub.shards_degraded")?.warn?.default).toBe(25);
    expect(catalog.find((r) => r.id === "eventsub.heartbeat_stale")?.group).toBe("EventSub");
  });
});
