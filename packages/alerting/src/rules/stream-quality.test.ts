import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ObsOutputWindowStats } from "@repo/metrics";
import type { EnvContext } from "../types";

const byLookback = new Map<string, ObsOutputWindowStats[]>();
// Keep every other export real: bun's module mocks are process-wide, and
// other test files import @repo/metrics too.
const realMetrics = await import("@repo/metrics");
mock.module("@repo/metrics", () => ({
  ...realMetrics,
  queryObsOutputWindowStats: async (lookback: string) => byLookback.get(lookback) ?? [],
}));

const { streamQualityRules } = await import("./stream-quality");

let names: { id: string; name: string | null }[] = [];
let namesFail = false;
const ctx = (): EnvContext =>
  ({
    env: "prod",
    now: new Date("2026-11-10T20:00:00Z"),
    supabase: {
      from: () => ({
        select: () => ({
          in: async () => {
            if (namesFail) throw new Error("db down");
            return { data: names };
          },
        }),
      }),
    },
    registry: {},
    probeResults: new Map(),
  }) as unknown as EnvContext;

const rule = (id: string, overrides = {}) => streamQualityRules(overrides).find((r) => r.id === id)!;

const stats = (over: Partial<ObsOutputWindowStats>): ObsOutputWindowStats => ({
  instanceId: "inst-1",
  nodeId: "node-1",
  userId: "user-1",
  totalFrames: 3600,
  droppedFrames: 0,
  congestion: 0,
  reconnects: 0,
  ...over,
});

beforeEach(() => {
  byLookback.clear();
  names = [{ id: "user-1", name: "xPudu" }];
  namesFail = false;
});

describe("stream.dropped_frames", () => {
  test("warns above 1% and goes crit above 5% of frames in the window", async () => {
    byLookback.set("2m", [
      stats({ droppedFrames: 18 }), // 0.5%
      stats({ instanceId: "inst-2", droppedFrames: 72 }), // 2%
      stats({ instanceId: "inst-3", droppedFrames: 360 }), // 10%
    ]);
    const breaches = await rule("stream.dropped_frames").evaluate(ctx());
    expect(breaches.map((b) => [b.entityId, b.severity])).toEqual([
      ["user-1:inst-2", "warn"],
      ["user-1:inst-3", "crit"],
    ]);
    expect(breaches[0]?.message).toContain("Stream by xPudu");
    expect(breaches[0]?.value).toBeCloseTo(2);
  });

  test("ignores a window with too few frames to judge", async () => {
    byLookback.set("2m", [stats({ totalFrames: 300, droppedFrames: 300 })]);
    expect(await rule("stream.dropped_frames").evaluate(ctx())).toEqual([]);
  });

  test("an admin override moves the thresholds", async () => {
    byLookback.set("2m", [stats({ droppedFrames: 72 })]); // 2%
    const breaches = await rule("stream.dropped_frames", { "stream.dropped_frames": { warn: 3 } }).evaluate(ctx());
    expect(breaches).toEqual([]);
  });

  test("falls back to the user id when the name lookup fails", async () => {
    namesFail = true;
    byLookback.set("2m", [stats({ droppedFrames: 360 })]);
    const [breach] = await rule("stream.dropped_frames").evaluate(ctx());
    expect(breach?.message).toContain("Stream by user-1");
  });
});

describe("stream.congestion", () => {
  test("reads congestion as a percent and skips instances that aren't streaming", async () => {
    byLookback.set("2m", [
      stats({ congestion: 0.2 }),
      stats({ instanceId: "inst-2", congestion: 0.45 }),
      stats({ instanceId: "inst-3", congestion: 0.8 }),
      stats({ instanceId: "inst-4", congestion: null, totalFrames: 0 }),
    ]);
    const breaches = await rule("stream.congestion").evaluate(ctx());
    expect(breaches.map((b) => [b.entityId, b.severity])).toEqual([
      ["user-1:inst-2", "warn"],
      ["user-1:inst-3", "crit"],
    ]);
  });
});

describe("stream.reconnect_loop", () => {
  test("fires crit at 3 reconnects in 10 minutes", async () => {
    byLookback.set("10m", [stats({ reconnects: 2 }), stats({ instanceId: "inst-2", reconnects: 3 })]);
    const breaches = await rule("stream.reconnect_loop").evaluate(ctx());
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ entityId: "user-1:inst-2", severity: "crit", value: 3 });
  });
});
