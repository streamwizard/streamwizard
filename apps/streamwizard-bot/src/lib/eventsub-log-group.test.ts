import { describe, expect, test } from "bun:test";
import type { EmitPlatformEventInput } from "@repo/supabase/queries/platform-events";
import { createEventSubLogGroup, mergeEventSubRows } from "./eventsub-log-group";

const SERVICE = "streamwizard-bot";

const connected = (shard: string): EmitPlatformEventInput => ({
  type: "eventsub.connected",
  payload: { service: SERVICE, shard_id: shard, session_id: `s${shard}` },
});
const lost = (shard: string, reason = "keepalive timeout", code: number | null = null, silentMs: number | null = null): EmitPlatformEventInput => ({
  type: "eventsub.connection_lost",
  payload: { service: SERVICE, shard_id: shard, reason, close_code: code, keepalive_silent_ms: silentMs },
});
const reconnected = (shard: string, downtimeMs: number, attempts: number): EmitPlatformEventInput => ({
  type: "eventsub.reconnected",
  payload: { service: SERVICE, shard_id: shard, session_id: `s${shard}`, downtime_ms: downtimeMs, attempts },
});
const revoked = (shard: string): EmitPlatformEventInput => ({
  type: "eventsub.subscription_revoked",
  payload: { service: SERVICE, shard_id: shard, subscription_type: "channel.follow", status: "authorization_revoked", reason: "revoked" },
});

const types = (rows: EmitPlatformEventInput[]) => rows.map((row) => row.type);
const shardsOf = (row: EmitPlatformEventInput): string[] => {
  const payload = row.payload as { shard_id?: string; shard_ids?: string[] };
  return payload.shard_ids ?? (payload.shard_id !== undefined ? [payload.shard_id] : []);
};

describe("mergeEventSubRows", () => {
  test("a boot with several shards is one connected row listing them in order", () => {
    const rows = mergeEventSubRows([connected("2"), connected("0"), connected("10"), connected("1")]);
    expect(rows).toEqual([
      { type: "eventsub.connected", payload: { service: SERVICE, shard_ids: ["0", "1", "2", "10"], session_id: null } },
    ]);
  });

  test("a single row is passed through untouched", () => {
    const row = connected("3");
    expect(mergeEventSubRows([row])).toEqual([row]);
  });

  test("a blip is one lost row and one reconnected row, with the worst downtime and attempts", () => {
    const rows = mergeEventSubRows([
      lost("0", "keepalive timeout", null, 15_000),
      lost("1", "keepalive timeout", null, 18_000),
      reconnected("0", 4000, 1),
      reconnected("1", 9500, 3),
    ]);
    expect(rows).toEqual([
      {
        type: "eventsub.connection_lost",
        payload: { service: SERVICE, shard_ids: ["0", "1"], reason: "keepalive timeout", close_code: null, keepalive_silent_ms: 18_000 },
      },
      {
        type: "eventsub.reconnected",
        payload: { service: SERVICE, shard_ids: ["0", "1"], session_id: null, downtime_ms: 9500, attempts: 3 },
      },
    ]);
  });

  test("different reasons are all kept, and a close code only when every shard had the same one", () => {
    const [mixed] = mergeEventSubRows([lost("0", "keepalive timeout"), lost("1", "Invalid reconnect", 4007)]);
    expect(mixed?.payload).toMatchObject({ reason: "keepalive timeout, Invalid reconnect", close_code: null });

    const [same] = mergeEventSubRows([lost("0", "connection unused", 4003), lost("1", "connection unused", 4003)]);
    expect(same?.payload).toMatchObject({ reason: "connection unused", close_code: 4003 });
  });

  test("a flapping shard keeps its lost, back, lost, back sequence", () => {
    const rows = mergeEventSubRows([
      lost("0"),
      lost("1"),
      reconnected("0", 1000, 1),
      reconnected("1", 1000, 1),
      lost("0"),
      reconnected("0", 2000, 1),
    ]);
    expect(types(rows)).toEqual([
      "eventsub.connection_lost",
      "eventsub.reconnected",
      "eventsub.connection_lost",
      "eventsub.reconnected",
    ]);
    expect(rows[0]?.payload).toMatchObject({ shard_ids: ["0", "1"] });
    expect(rows[2]?.payload).toMatchObject({ shard_id: "0" });
  });

  test("revocations are never merged and keep their place", () => {
    const rows = mergeEventSubRows([connected("0"), revoked("0"), revoked("1"), connected("1")]);
    expect(types(rows)).toEqual(["eventsub.connected", "eventsub.subscription_revoked", "eventsub.subscription_revoked"]);
    expect(rows[0]?.payload).toMatchObject({ shard_ids: ["0", "1"] });
  });
});

describe("createEventSubLogGroup", () => {
  const collect = () => {
    const sent: EmitPlatformEventInput[] = [];
    return { sent, send: async (event: EmitPlatformEventInput) => void sent.push(event) };
  };

  test("holds connection rows until flushed, then sends them merged", async () => {
    const { sent, send } = collect();
    const group = createEventSubLogGroup(send, { quietMs: 60_000, maxWaitMs: 60_000 });
    group.emit(connected("0"));
    group.emit(connected("1"));
    expect(sent).toEqual([]);
    await group.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload).toMatchObject({ shard_ids: ["0", "1"] });
  });

  test("sends on its own once no new row arrives", async () => {
    const { sent, send } = collect();
    const group = createEventSubLogGroup(send, { quietMs: 20, maxWaitMs: 1000 });
    group.emit(lost("0"));
    group.emit(lost("1"));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(types(sent)).toEqual(["eventsub.connection_lost"]);
  });

  test("a steady stream of rows still goes out after the maximum wait", async () => {
    const { sent, send } = collect();
    const group = createEventSubLogGroup(send, { quietMs: 40, maxWaitMs: 60 });
    for (const shard of ["0", "1", "2", "3"]) {
      group.emit(connected(shard));
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
    // Without the cap all four would be one row; the cap splits the stream.
    expect(sent.length).toBeGreaterThanOrEqual(2);
    expect(sent.flatMap(shardsOf)).toEqual(["0", "1", "2", "3"]);
  });

  test("a revocation is sent straight away", async () => {
    const { sent, send } = collect();
    const group = createEventSubLogGroup(send, { quietMs: 60_000, maxWaitMs: 60_000 });
    group.emit(connected("0"));
    group.emit(revoked("0"));
    await Promise.resolve();
    await Promise.resolve();
    expect(types(sent)).toEqual(["eventsub.subscription_revoked"]);
    await group.flush();
    expect(types(sent)).toEqual(["eventsub.subscription_revoked", "eventsub.connected"]);
  });
});
