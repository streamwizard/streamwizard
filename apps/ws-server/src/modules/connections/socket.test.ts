import { describe, expect, mock, test } from "bun:test";

mock.module("@repo/supabase", () => ({ supabase: {} }));

const { websocketHandlers } = await import("./socket");
const { rooms } = await import("@/modules/rooms/rooms");

function roomWithListener(userId: string): string[] {
  const got: string[] = [];
  rooms.set(userId, { subscribers: new Set([{ data: { channels: new Set() }, send: (m: string) => got.push(m) }]) } as never);
  return got;
}

function socket(role: string, userId: string) {
  return { data: { role, userId, channels: new Set(), connectedAt: Date.now(), connId: "c-test" }, send: () => {} } as never;
}

describe("message routing", () => {
  test("ignores frames from subscribers", () => {
    const got = roomWithListener("u-sub");
    websocketHandlers.message(socket("subscriber", "u-sub"), JSON.stringify({ type: "geo", payload: { latitude: 1, longitude: 2 } }));
    expect(got.length).toBe(0);
  });

  test("relays a bot broadcast to the target room", () => {
    const got = roomWithListener("u-bot");
    websocketHandlers.message(socket("bot", "_bot"), JSON.stringify({ userId: "u-bot", type: "channel.follow", payload: {} }));
    expect(got.length).toBe(1);
  });
});

describe("frame parsing", () => {
  function sending(role: string, extra: Record<string, unknown> = {}) {
    const sent: string[] = [];
    const ws = {
      data: { role, userId: "_bot", channels: new Set(), connectedAt: Date.now(), connId: `c-${role}`, ...extra },
      send: (m: string) => sent.push(m),
    };
    return { ws: ws as never, sent };
  }

  test("a bot ping gets a pong; a ping without ts is dropped", () => {
    const { ws, sent } = sending("bot");
    websocketHandlers.message(ws, JSON.stringify({ kind: "ping", ts: 42 }));
    websocketHandlers.message(ws, JSON.stringify({ kind: "ping" }));
    expect(sent.map((m) => JSON.parse(m))).toEqual([{ kind: "pong", ts: 42 }]);
  });

  test("malformed bot frames never reach a room or throw", () => {
    const got = roomWithListener("u-bad");
    const { ws } = sending("bot");
    for (const frame of ["{not json", "[]", JSON.stringify({ userId: "u-bad" }), JSON.stringify({ userId: "u-bad", type: 5, payload: {} })]) {
      websocketHandlers.message(ws, frame);
    }
    expect(got.length).toBe(0);
  });

  test("an ingest node ping gets a pong; unknown kinds are dropped", () => {
    const { ws, sent } = sending("ingest-node", { ingestNodeId: "aaaaaaaa-0000-4000-8000-000000000001" });
    websocketHandlers.message(ws, JSON.stringify({ kind: "ping", ts: 7 }));
    websocketHandlers.message(ws, JSON.stringify({ kind: "hello" }));
    websocketHandlers.message(ws, JSON.stringify({ userId: "u", type: "channel.follow", payload: {} }));
    expect(sent.map((m) => JSON.parse(m))).toEqual([{ kind: "pong", ts: 7 }]);
  });
});
