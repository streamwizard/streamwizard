import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "development";
process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SECRET_KEY ??= "test-secret";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-key";

// The default registry's DB lookup is never used here; each test builds its own.
mock.module("@repo/supabase", () => ({ supabase: {} }));

const { createIngestSessionRegistry } = await import("./ingest-sessions");
const { resolveIngestStats, boundStats, nodeBandwidthFrom } = await import("./ingest-node-messages");
const { routeBotBroadcast } = await import("./bot-router");
const { consumers } = await import("./consumers");
const { rooms } = await import("./rooms");

const NODE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const NODE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const SESSION = "5e550000-0000-4000-8000-000000000001";
const USER = "0e0e0000-0000-4000-8000-000000000001";
const KEY = "4e440000-0000-4000-8000-000000000001";

let clock = 1_000_000;
let lookups = 0;
let dbRows: Map<string, { userId: string; nodeId: string | null; streamKeyId: string; label: string | null; endedAt?: number }>;

function registry() {
  return createIngestSessionRegistry({
    lookup: async (id) => {
      lookups++;
      await Promise.resolve();
      const row = dbRows.get(id);
      return row ? { ...row } : null;
    },
    now: () => clock,
  });
}

const sample = (overrides: Record<string, unknown> = {}) => ({
  session_id: SESSION,
  protocol: "srt",
  stats: { kbps: 4500, rtt_ms: 30 },
  ...overrides,
});

beforeEach(() => {
  clock = 1_000_000;
  lookups = 0;
  dbRows = new Map();
});

describe("ingest_stats routing", () => {
  test("a registered session's sample gets the user, key and label from the registry", async () => {
    const reg = registry();
    reg.register({ sessionId: SESSION, userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: "Camera 1" });
    const res = await resolveIngestStats(reg, NODE_A, sample());
    expect(res).toEqual({
      ok: true,
      userId: USER,
      payload: { kbps: 4500, rtt_ms: 30, session_id: SESSION, protocol: "srt", node_id: NODE_A, stream_key_id: KEY, label: "Camera 1" },
    });
    expect(lookups).toBe(0);
  });

  test("a sample for another node's session is dropped", async () => {
    const reg = registry();
    reg.register({ sessionId: SESSION, userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: null });
    expect(await resolveIngestStats(reg, NODE_B, sample())).toEqual({ ok: false, reason: "foreign_session" });
  });

  test("identity fields can't be overridden through stats", async () => {
    const reg = registry();
    reg.register({ sessionId: SESSION, userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: null });
    const res = await resolveIngestStats(
      reg,
      NODE_A,
      sample({ stats: { kbps: 1, node_id: 7, stream_key_id: 8, label: 9, session_id: 10, protocol: 11 } }),
    );
    if (!res.ok) throw new Error("expected ok");
    expect(res.payload).toEqual({ kbps: 1, session_id: SESSION, protocol: "srt", node_id: NODE_A, stream_key_id: KEY });
  });

  test("an unregistered but valid session resolves through the DB once, then from cache", async () => {
    dbRows.set(SESSION, { userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: "Camera 1" });
    const reg = registry();
    // Concurrent samples share one lookup (single-flight).
    const [a, b] = await Promise.all([resolveIngestStats(reg, NODE_A, sample()), resolveIngestStats(reg, NODE_A, sample())]);
    expect(a.ok && b.ok).toBe(true);
    await resolveIngestStats(reg, NODE_A, sample());
    expect(lookups).toBe(1);
  });

  test("an unknown id is looked up once per miss window, not per sample", async () => {
    const reg = registry();
    expect(await resolveIngestStats(reg, NODE_A, sample())).toEqual({ ok: false, reason: "unknown_session" });
    await resolveIngestStats(reg, NODE_A, sample());
    expect(lookups).toBe(1);
    clock += 6_000;
    await resolveIngestStats(reg, NODE_A, sample());
    expect(lookups).toBe(2);
  });

  test("an ended session drops samples quietly, then is evicted after the grace period", async () => {
    const reg = registry();
    reg.register({ sessionId: SESSION, userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: null });
    reg.end(SESSION);
    expect(await resolveIngestStats(reg, NODE_A, sample())).toEqual({ ok: false, reason: "ended_session" });
    expect(lookups).toBe(0);
    clock += 31_000;
    expect(await resolveIngestStats(reg, NODE_A, sample())).toEqual({ ok: false, reason: "unknown_session" });
  });

  test("ending an unknown session leaves a tombstone, so a late sample needs no DB lookup", async () => {
    const reg = registry();
    reg.end(SESSION);
    expect(await resolveIngestStats(reg, NODE_A, sample())).toEqual({ ok: false, reason: "ended_session" });
    expect(lookups).toBe(0);
  });

  test("malformed samples are dropped before any lookup", async () => {
    const reg = registry();
    for (const bad of [sample({ session_id: "not-a-uuid" }), sample({ protocol: "webrtc" }), sample({ stats: "x" })]) {
      expect(await resolveIngestStats(reg, NODE_A, bad)).toEqual({ ok: false, reason: "malformed_ingest_stats" });
    }
    expect(lookups).toBe(0);
  });
});

describe("lookup budget", () => {
  test("a node sending junk ids gets a few DB lookups, then none until the window passes", async () => {
    const reg = createIngestSessionRegistry({
      lookup: async () => {
        lookups++;
        return null;
      },
      lookupsPerWindow: 3,
      lookupWindowMs: 10_000,
      now: () => clock,
    });
    const junk = (i: number) => sample({ session_id: `5e550000-0000-4000-8000-${String(i).padStart(12, "0")}` });
    for (let i = 0; i < 10; i++) await resolveIngestStats(reg, NODE_A, junk(i));
    expect(lookups).toBe(3);
    // Another node has its own budget.
    await resolveIngestStats(reg, NODE_B, junk(100));
    expect(lookups).toBe(4);
    clock += 10_001;
    await resolveIngestStats(reg, NODE_A, junk(200));
    expect(lookups).toBe(5);
  });

  test("a registered session never needs the budget", async () => {
    const reg = createIngestSessionRegistry({ lookup: async () => null, lookupsPerWindow: 0, now: () => clock });
    reg.register({ sessionId: SESSION, userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: null });
    expect((await resolveIngestStats(reg, NODE_A, sample())).ok).toBe(true);
  });
});

describe("bounds", () => {
  test("stats keep numbers only, at most 64 keys", () => {
    const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(boundStats(many)!)).toHaveLength(64);
    expect(boundStats({ a: 1, b: "2", c: Number.NaN, d: null })).toEqual({ a: 1 });
  });

  test("node_metrics takes the node from the token, never from the payload", () => {
    expect(nodeBandwidthFrom(NODE_A, { node_id: NODE_B, ts: 1, rx_bytes_per_sec: 10, tx_bytes_per_sec: 20 })).toEqual({
      ts: 1,
      rx_bytes_per_sec: 10,
      tx_bytes_per_sec: 20,
      tailscale_rx_bytes_per_sec: 0,
      tailscale_tx_bytes_per_sec: 0,
      node_id: NODE_A,
    });
    expect(nodeBandwidthFrom(NODE_A, { rx_bytes_per_sec: "x" })).toBeNull();
  });
});

describe("delivery", () => {
  test("a routed sample reaches both the user's room and the consumers", async () => {
    const reg = registry();
    reg.register({ sessionId: SESSION, userId: USER, nodeId: NODE_A, streamKeyId: KEY, label: null });
    const res = await resolveIngestStats(reg, NODE_A, sample());
    if (!res.ok) throw new Error("expected ok");

    const roomGot: string[] = [];
    const consumerGot: string[] = [];
    const subscriber = { data: { role: "subscriber", channels: new Set() }, send: (m: string) => roomGot.push(m) };
    const consumer = { data: { role: "consumer", consumerTypes: new Set(["streamwizard.ingest_stats"]) }, send: (m: string) => consumerGot.push(m) };
    rooms.set(USER, { subscribers: new Set([subscriber as never]) });
    consumers.add(consumer as never);
    try {
      expect(routeBotBroadcast({ userId: USER, type: "streamwizard.ingest_stats", payload: res.payload }, "ingest-node:test")).toEqual({ delivered: true });
    } finally {
      rooms.delete(USER);
      consumers.delete(consumer as never);
    }
    expect(roomGot).toHaveLength(1);
    expect(consumerGot).toHaveLength(1);
    expect(JSON.parse(consumerGot[0]!)).toMatchObject({ userId: USER, type: "streamwizard.ingest_stats", payload: { session_id: SESSION } });
  });
});
