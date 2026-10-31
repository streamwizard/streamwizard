import { describe, expect, mock, test } from "bun:test";

mock.module("@repo/supabase", () => ({ supabase: {} }));

const { websocketHandlers } = await import("./ws");
const { rooms } = await import("../rooms");

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
