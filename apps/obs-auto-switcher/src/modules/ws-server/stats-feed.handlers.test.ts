import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

let reported: { context: string; extra?: Record<string, unknown> }[] = [];

// Spread the real exports: bun shares module mocks across test files.
const realSentry = await import("@repo/sentry");
mock.module("@repo/sentry", () => ({
  ...realSentry,
  reportError: (_err: unknown, context: string, extra?: Record<string, unknown>) => {
    reported.push({ context, extra });
  },
}));

// Captures the socket StatsFeed opens so a test can feed it frames.
class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeWebSocket.last = this;
  }
  close() {}
}

const RealWebSocket = globalThis.WebSocket;
globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
afterAll(() => {
  globalThis.WebSocket = RealWebSocket;
});

const { StatsFeed } = await import("./stats-feed");

const USER = "0e0e0000-0000-4000-8000-000000000001";
const SESSION = "5e550000-0000-4000-8000-000000000001";
const statsFrame = JSON.stringify({
  userId: USER,
  type: "streamwizard.ingest_stats",
  payload: { session_id: SESSION, protocol: "srt", kbps: 4500, rtt_ms: 30 },
  ts: 1,
});

async function openFeed(onIngestStats: () => void) {
  const feed = new StatsFeed("ws://feed.test", async () => "Bearer t", {
    onIngestStats,
    onConfigPush: () => {},
  });
  feed.connect();
  // dial() awaits the auth header before it opens the socket.
  await new Promise((r) => setTimeout(r, 0));
  const ws = FakeWebSocket.last;
  if (!ws?.onmessage) throw new Error("feed did not open a socket");
  return { feed, ws };
}

beforeEach(() => {
  reported = [];
  FakeWebSocket.last = null;
});

describe("stats feed message handling", () => {
  test("a handler that throws is reported, not passed to the process handler", async () => {
    const { feed, ws } = await openFeed(() => {
      throw new Error("engine broke");
    });
    expect(() => ws.onmessage!({ data: statsFrame })).not.toThrow();
    expect(reported).toEqual([{ context: "stats-feed: message", extra: { userId: USER, type: "streamwizard.ingest_stats" } }]);
    feed.disconnect();
  });

  test("the same failure is reported once, not once per message", async () => {
    const { feed, ws } = await openFeed(() => {
      throw new Error("engine broke again");
    });
    for (let i = 0; i < 5; i++) ws.onmessage!({ data: statsFrame });
    expect(reported).toHaveLength(1);
    feed.disconnect();
  });
});
