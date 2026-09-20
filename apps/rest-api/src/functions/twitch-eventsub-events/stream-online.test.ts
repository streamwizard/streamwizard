import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * Drives handleStreamOnline with every collaborator mocked. The cases pin
 * down one thing: a missing archive video is not a failure. The stream row,
 * live status and poller all happen without it.
 */

type Stream = { id: string; user_id: string; user_name: string; started_at: string; title: string; game_id: string; game_name: string };

const stream: Stream = {
  id: "s1",
  user_id: "b1",
  user_name: "Streamer",
  started_at: "2026-09-20T10:00:00.000Z",
  title: "Title",
  game_id: "g",
  game_name: "Game",
};

let streamResult: Stream | undefined;
let lookupResult: string | null;
let vodUpserts: Record<string, unknown>[];
let videoIdWrites: [string, string][];
let liveStatusUpserts: Record<string, unknown>[];
let pollerStarts: unknown[][];
let failures: unknown[][];
let reported: string[];

mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));
mock.module("@repo/supabase", () => ({ supabase: {} }));
// Same export set as viewer-count-poller.test.ts: bun's mock.module is
// process-wide, so both files must agree on the module's shape.
mock.module("@repo/supabase/queries/vods", () => ({
  getVodVideoIdByStreamId: async () => null,
  upsertVod: async (_client: unknown, row: Record<string, unknown>) => {
    vodUpserts.push(row);
  },
  setVodVideoId: async (_client: unknown, streamId: string, videoId: string) => {
    videoIdWrites.push([streamId, videoId]);
    return true;
  },
}));
mock.module("@repo/supabase/queries/live-status", () => ({
  getLiveBroadcasters: async () => [],
  upsertBroadcasterLiveStatus: async (_client: unknown, row: Record<string, unknown>) => {
    liveStatusUpserts.push(row);
  },
}));
mock.module("@repo/logger", () => ({
  streamEventsLogger: { logTwitchEvent: async () => {} },
}));
mock.module("@repo/twitch-api", () => ({ TwitchApi: class {} }));
mock.module("../../services/viewer-count-poller", () => ({
  viewerCountPoller: {
    startPolling: (...args: unknown[]) => {
      pollerStarts.push(args);
    },
  },
}));
mock.module("../../lib/ws-server", () => ({ notifyStreamStatus: async () => {} }));
mock.module("../../lib/user-state", () => ({ setStreamUserState: async () => {} }));
mock.module("../../lib/platform-events", () => ({
  logStreamOnlineFailed: async (...args: unknown[]) => {
    failures.push(args);
  },
}));
mock.module("../../lib/stream-video", () => ({
  findVideoIdForStream: async () => lookupResult,
}));

let handleStreamOnline: typeof import("./stream-online").handleStreamOnline;

beforeAll(async () => {
  ({ handleStreamOnline } = await import("./stream-online"));
});

beforeEach(() => {
  streamResult = stream;
  lookupResult = null;
  vodUpserts = [];
  videoIdWrites = [];
  liveStatusUpserts = [];
  pollerStarts = [];
  failures = [];
  reported = [];
});

const twitchApi = () => ({ streams: { getStream: async () => streamResult } }) as never;
const event = { type: "live", broadcaster_user_id: "b1", broadcaster_user_name: "Streamer" } as never;

describe("handleStreamOnline", () => {
  it("tracks the stream without an archive video", async () => {
    await handleStreamOnline(event, twitchApi());

    expect(vodUpserts).toEqual([{ broadcaster_id: "b1", stream_id: "s1", started_at: stream.started_at }]);
    expect(videoIdWrites).toHaveLength(0);
    expect(liveStatusUpserts).toHaveLength(1);
    expect(pollerStarts).toEqual([["b1", "s1", null]]);
    expect(failures).toHaveLength(0);
    expect(reported).toHaveLength(0);
  });

  it("attaches the archive video when Twitch already lists it", async () => {
    lookupResult = "v1";
    await handleStreamOnline(event, twitchApi());

    expect(vodUpserts).toHaveLength(1);
    expect(videoIdWrites).toEqual([["s1", "v1"]]);
    expect(pollerStarts).toEqual([["b1", "s1", "v1"]]);
  });

  it("still gives up when Twitch does not return the stream", async () => {
    streamResult = undefined;
    await handleStreamOnline(event, twitchApi());

    expect(vodUpserts).toHaveLength(0);
    expect(liveStatusUpserts).toHaveLength(0);
    expect(pollerStarts).toHaveLength(0);
    expect(failures).toEqual([["b1", "stream_not_found", null]]);
    expect(reported).toEqual(["eventsub.stream-online"]);
  });
});
