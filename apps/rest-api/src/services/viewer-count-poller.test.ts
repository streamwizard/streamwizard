import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, setSystemTime } from "bun:test";

/**
 * Drives the poller through `tick()` directly; the 5-minute interval never
 * fires inside a test. Every collaborator is a mock with a small mutable
 * control surface below, reset before each case.
 */

type Stream = { id: string; started_at: string; viewer_count: number; game_id: string; game_name: string; title: string };
type Clip = { id: string; video_id: string | null };
type ClipPage = { data: Clip[]; pagination?: { cursor?: string } };

const BROADCASTER = "b1";
const STREAM_ID = "s1";
const STREAM_STARTED_AT = "2026-09-20T10:00:00.000Z";

const liveStream = (id = STREAM_ID): Stream => ({
  id,
  started_at: STREAM_STARTED_AT,
  viewer_count: 42,
  game_id: "g",
  game_name: "Game",
  title: "Title",
});

let streamResult: () => Promise<Stream | undefined>;
let clipPages: ClipPage[];
let clipCalls: Record<string, unknown>[];
let upserts: unknown[][];
let upsertFails: boolean;
let viewerInserts: unknown[];
let integrationResult: { data: { user_id: string } | null; error: unknown };
let preferences: { sync_clips_on_end: boolean } | null;
let liveRows: { broadcaster_id: string; stream_id: string }[];
let reported: string[];
let formatGate: Promise<void> | null;

mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));
mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/clips", () => ({
  upsertClips: async (_client: unknown, rows: unknown[]) => {
    if (upsertFails) throw new Error("upsert failed");
    upserts.push(rows);
  },
}));
mock.module("@repo/supabase/queries/live-status", () => ({
  getLiveBroadcasters: async () => liveRows,
}));
mock.module("@repo/supabase/queries/user", () => ({
  getTwitchIntegrationByBroadcasterId: async () => integrationResult,
  getUserPreferencesByUserId: async () => preferences,
}));
mock.module("@repo/supabase/queries/viewer-counts", () => ({
  insertViewerCount: async (_client: unknown, row: unknown) => {
    viewerInserts.push(row);
  },
}));
mock.module("@repo/twitch-api", () => ({
  TwitchApi: class {
    streams = { getStream: () => streamResult() };
    clips = {
      getClips: async (params: Record<string, unknown>) => {
        clipCalls.push(params);
        return clipPages.shift() ?? { data: [], pagination: {} };
      },
    };
  },
}));
mock.module("../functions/sync-twitch", () => ({
  formatClipsForDB: async (clips: Clip[]) => {
    if (formatGate) await formatGate;
    return clips.map((clip) => ({ twitch_clip_id: clip.id }));
  },
}));

let poller: typeof import("./viewer-count-poller").viewerCountPoller;
let clipWindowStart: typeof import("./viewer-count-poller").clipWindowStart;

beforeAll(async () => {
  const mod = await import("./viewer-count-poller");
  poller = mod.viewerCountPoller;
  clipWindowStart = mod.clipWindowStart;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

/** startPolling fires a tick of its own; wait for it so cases start from a clean slate. */
const start = async (broadcasterId = BROADCASTER, streamId = STREAM_ID) => {
  poller.startPolling(broadcasterId, streamId);
  await settle();
};

const clips = (...ids: string[]): Clip[] => ids.map((id) => ({ id, video_id: null }));

beforeEach(() => {
  streamResult = async () => liveStream();
  clipPages = [];
  clipCalls = [];
  upserts = [];
  upsertFails = false;
  viewerInserts = [];
  integrationResult = { data: { user_id: "u1" }, error: null };
  preferences = { sync_clips_on_end: true };
  liveRows = [];
  reported = [];
  formatGate = null;
  setSystemTime(new Date("2026-09-20T11:00:00.000Z"));
});

afterEach(() => {
  for (const id of [BROADCASTER, "b2", "b3"]) if (poller.isPolling(id)) poller.stopPolling(id);
  setSystemTime();
});

describe("clipWindowStart", () => {
  const started = new Date(STREAM_STARTED_AT);

  it("covers the whole stream before the first pull", () => {
    expect(clipWindowStart(started, null)).toEqual(started);
  });

  it("reaches 15 minutes back from the previous pull", () => {
    const last = new Date("2026-09-20T12:00:00.000Z");
    expect(clipWindowStart(started, last)).toEqual(new Date("2026-09-20T11:45:00.000Z"));
  });

  it("never reaches before the stream started", () => {
    const last = new Date("2026-09-20T10:05:00.000Z");
    expect(clipWindowStart(started, last)).toEqual(started);
  });
});

describe("clip window per tick", () => {
  it("asks for the whole stream on the first tick, with an explicit ended_at", async () => {
    await start();

    expect(clipCalls).toHaveLength(1);
    expect(clipCalls[0]).toMatchObject({
      broadcaster_id: BROADCASTER,
      started_at: STREAM_STARTED_AT,
      ended_at: "2026-09-20T11:00:00.000Z",
      first: 100,
    });
  });

  it("moves the window forward after a successful pull", async () => {
    await start();

    setSystemTime(new Date("2026-09-20T11:05:00.000Z"));
    await poller.tick(BROADCASTER);

    expect(clipCalls[1]).toMatchObject({
      started_at: "2026-09-20T10:45:00.000Z",
      ended_at: "2026-09-20T11:05:00.000Z",
    });
  });

  it("keeps the old window when a pull fails", async () => {
    await start();

    upsertFails = true;
    clipPages = [{ data: clips("c1"), pagination: {} }];
    setSystemTime(new Date("2026-09-20T11:05:00.000Z"));
    await poller.tick(BROADCASTER);
    expect(reported).toContain("viewer-count-poller.clips");

    upsertFails = false;
    setSystemTime(new Date("2026-09-20T11:10:00.000Z"));
    await poller.tick(BROADCASTER);

    // Window still anchored on the 11:00 pull, not the failed 11:05 one.
    expect(clipCalls[2]).toMatchObject({ started_at: "2026-09-20T10:45:00.000Z" });
  });

  it("follows the cursor and upserts every page", async () => {
    clipPages = [
      { data: clips("c1", "c2"), pagination: { cursor: "p2" } },
      { data: clips("c3"), pagination: {} },
    ];
    await start();

    expect(clipCalls.map((c) => c.after)).toEqual([undefined, "p2"]);
    expect(upserts).toEqual([[{ twitch_clip_id: "c1" }, { twitch_clip_id: "c2" }], [{ twitch_clip_id: "c3" }]]);
  });

  it("stops at the page cap and still advances the window", async () => {
    clipPages = Array.from({ length: 6 }, (_, i) => ({ data: clips(`c${i}`), pagination: { cursor: `p${i + 1}` } }));
    await start();

    expect(clipCalls).toHaveLength(5);

    setSystemTime(new Date("2026-09-20T11:05:00.000Z"));
    await poller.tick(BROADCASTER);
    expect(clipCalls[5]).toMatchObject({ started_at: "2026-09-20T10:45:00.000Z" });
  });

  it("skips clips when the user opted out", async () => {
    preferences = { sync_clips_on_end: false };
    await start();

    expect(viewerInserts).toHaveLength(1);
    expect(clipCalls).toHaveLength(0);
  });

  it("reports an integration lookup error instead of swallowing it", async () => {
    integrationResult = { data: null, error: new Error("db down") };
    await start();

    expect(reported).toContain("viewer-count-poller.integration");
    expect(clipCalls).toHaveLength(0);
    expect(viewerInserts).toHaveLength(1);
  });
});

describe("stale ticks", () => {
  it("does not record a viewer sample after stopPolling", async () => {
    await start();

    let release!: () => void;
    streamResult = () => new Promise((resolve) => (release = () => resolve(liveStream())));

    const inflight = poller.tick(BROADCASTER);
    await settle();
    poller.stopPolling(BROADCASTER);
    release();
    await inflight;

    expect(viewerInserts).toHaveLength(1);
  });

  it("does not upsert clips after stopPolling mid-pull", async () => {
    await start();

    let release!: () => void;
    formatGate = new Promise((resolve) => (release = resolve));
    clipPages = [{ data: clips("c1"), pagination: {} }];

    const inflight = poller.tick(BROADCASTER);
    await settle();
    poller.stopPolling(BROADCASTER);
    release();
    await inflight;

    expect(upserts).toHaveLength(0);
  });

  it("does not write for the old stream after a restart with a new stream id", async () => {
    await start();

    let release!: () => void;
    streamResult = () => new Promise((resolve) => (release = () => resolve(liveStream())));
    const inflight = poller.tick(BROADCASTER);
    await settle();

    streamResult = async () => liveStream("s2");
    await start(BROADCASTER, "s2");
    const insertsAfterRestart = viewerInserts.length;

    release();
    await inflight;

    expect(viewerInserts).toHaveLength(insertsAfterRestart);
    expect(poller.isPolling(BROADCASTER)).toBe(true);
  });
});

describe("stream lookup misses", () => {
  it("survives two empty /streams answers and stops on the third", async () => {
    await start();

    streamResult = async () => undefined;
    await poller.tick(BROADCASTER);
    expect(poller.isPolling(BROADCASTER)).toBe(true);
    await poller.tick(BROADCASTER);
    expect(poller.isPolling(BROADCASTER)).toBe(true);
    await poller.tick(BROADCASTER);
    expect(poller.isPolling(BROADCASTER)).toBe(false);
  });

  it("resets the miss count on a hit", async () => {
    await start();

    streamResult = async () => undefined;
    await poller.tick(BROADCASTER);
    await poller.tick(BROADCASTER);
    streamResult = async () => liveStream();
    await poller.tick(BROADCASTER);
    streamResult = async () => undefined;
    await poller.tick(BROADCASTER);
    await poller.tick(BROADCASTER);

    expect(poller.isPolling(BROADCASTER)).toBe(true);
  });

  it("stops when Twitch reports a different stream id", async () => {
    await start();

    streamResult = async () => liveStream("s2");
    await poller.tick(BROADCASTER);

    expect(poller.isPolling(BROADCASTER)).toBe(false);
    expect(viewerInserts).toHaveLength(1);
  });
});

describe("resume", () => {
  it("starts one poller per live row", async () => {
    liveRows = [
      { broadcaster_id: "b2", stream_id: "s2" },
      { broadcaster_id: "b3", stream_id: "s3" },
    ];
    // Twitch answers with each broadcaster's own stream id.
    const nextStreamId = ["s2", "s3"];
    streamResult = async () => liveStream(nextStreamId.shift());
    await poller.resume();
    await settle();

    expect(poller.isPolling("b2")).toBe(true);
    expect(poller.isPolling("b3")).toBe(true);
    expect(poller.getActivePollerCount()).toBe(2);
  });

  it("keeps the same stream's poller and replaces one for a new stream", async () => {
    await start();
    poller.startPolling(BROADCASTER, STREAM_ID);
    expect(poller.getActivePollerCount()).toBe(1);

    streamResult = async () => liveStream("s2");
    await start(BROADCASTER, "s2");
    expect(poller.getActivePollerCount()).toBe(1);
    expect(poller.isPolling(BROADCASTER)).toBe(true);
  });
});
