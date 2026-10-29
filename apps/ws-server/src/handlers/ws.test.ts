import { describe, expect, mock, test } from "bun:test";

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/irl", () => ({ insertIrlGeoTrack: () => Promise.resolve({ error: null }) }));

const { websocketHandlers } = await import("./ws");
const { rooms } = await import("../rooms");

function publisher(userId: string) {
  const ws = { data: { role: "publisher", userId, session_id: "s1", channels: new Set(), connectedAt: Date.now() }, send: () => {} };
  rooms.set(userId, { publisher: null, subscribers: new Set(), stream_id: "live-1" } as never);
  return ws as never;
}

describe("publisher frames", () => {
  // Each of these used to throw out of message() and exit the process.
  const bad = ["null", "5", "[]", '"geo"', '{"type":"geo"}', '{"type":"geo","payload":null}', '{"type":"geo","payload":{"timestamp":"not a date"}}'];

  for (const frame of bad) {
    test(`drops ${frame} without throwing`, () => {
      const ws = publisher(`u-${frame}`);
      expect(() => websocketHandlers.message(ws, frame)).not.toThrow();
    });
  }

  test("still relays a well-formed geo frame", () => {
    const ws = publisher("u-ok");
    const got: string[] = [];
    const room = rooms.get("u-ok")!;
    room.subscribers.add({ data: { channels: new Set() }, send: (m: string) => got.push(m) } as never);
    websocketHandlers.message(ws, JSON.stringify({ type: "geo", payload: { latitude: 1, longitude: 2, speed: 0, timestamp: Date.now() } }));
    expect(got.length).toBe(1);
  });
});
