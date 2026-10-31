import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

/**
 * getNextOverlayClip runs on the service role. It used to take the owner's
 * user id and the widget config from the caller, so anyone could page through
 * another streamer's clip library and mint signed MP4 URLs for it. It now
 * takes the overlay's subscriber_token and item id, and everything else is
 * looked up from those.
 */

const TOKEN = "a".repeat(64);
const OTHER_TOKEN = "b".repeat(64);
const SCENE = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222" };
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_ITEM_ID = "44444444-4444-4444-8444-444444444444";

let clipQueries: { userId: string | null }[];
let clipId: string;
let clipCounter = 0;
let itemType: string;

mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
mock.module("@repo/sentry", () => ({ reportError: () => {} }));
mock.module("@repo/supabase/queries/overlays", () => ({
  getOverlaySceneBySubscriberToken: async (_client: unknown, token: string) => ({
    data: token === TOKEN ? SCENE : null,
  }),
  getOverlayItemById: async (_client: unknown, itemId: string, sceneId: string) => ({
    data:
      itemId === ITEM_ID && sceneId === SCENE.id
        ? { id: ITEM_ID, type: itemType, config: { sort: "random", folderIds: [] } }
        : null,
  }),
}));
mock.module("@repo/supabase/queries/user", () => ({
  getTwitchUserIdByUserIdMaybe: async (_client: unknown, userId: string) => `twitch-of-${userId}`,
  getTwitchUserIdByUserId: async () => null,
}));
mock.module("@repo/supabase/queries/clips", () => ({
  createOverlayPlaylistClipQuery: () => {
    throw new Error("sequential path not used in this test");
  },
  getClipFolderJunctions: async () => ({ data: [], error: null }),
  pickRandomOverlayClip: async (_client: unknown, args: { p_user_id: string | null }) => {
    clipQueries.push({ userId: args.p_user_id });
    return {
      data: {
        id: "55555555-5555-4555-8555-555555555555",
        twitch_clip_id: clipId,
        broadcaster_id: "b1",
        title: "t",
        creator_name: "c",
        game_name: null,
        created_at_twitch: "2026-10-01T00:00:00Z",
        view_count: 1,
        duration: 10,
      },
      error: null,
    };
  },
}));
// Helix is mocked rather than @/actions/twitch, so the real download-URL
// cache and error classification run here too (and so twitch.test.ts, which
// tests that module, isn't handed a mock of it: bun's module mocks are global).
let download: () => Promise<{ data: { landscape_download_url?: string }[] }>;
let downloadCalls: number;
mock.module("@repo/twitch-api", () => ({
  TwitchApi: class {
    clips = {
      getClipDownloadUrl: async () => {
        downloadCalls++;
        return download();
      },
    };
  },
}));

function helix429(): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = { status: 429, statusText: "", headers: {}, config, data: {} } as AxiosResponse;
  return new AxiosError("Request failed", undefined, config, null, response);
}

const { getNextOverlayClip } = await import("./clips");

describe("getNextOverlayClip", () => {
  beforeEach(() => {
    clipQueries = [];
    itemType = "clips_widget";
    download = async () => ({ data: [{ landscape_download_url: "https://clips.example/x.mp4" }] });
    downloadCalls = 0;
    clipId = `Clip-${++clipCounter}`;
  });

  test("serves the scene owner's clips for the overlay's own item", async () => {
    const next = await getNextOverlayClip(TOKEN, ITEM_ID, null, []);
    expect(next?.videoUrl).toBe("https://clips.example/x.mp4");
    expect(clipQueries).toEqual([{ userId: SCENE.user_id }]);
  });

  test("refuses a wrong token, a foreign item or a non-clips item without touching clips", async () => {
    expect(await getNextOverlayClip(OTHER_TOKEN, ITEM_ID, null, [])).toBeNull();
    expect(await getNextOverlayClip("not-a-token", ITEM_ID, null, [])).toBeNull();
    expect(await getNextOverlayClip(TOKEN, FOREIGN_ITEM_ID, null, [])).toBeNull();
    // An old-style call (owner id + config object) matches nothing.
    expect(await getNextOverlayClip(SCENE.user_id, { folderIds: [] } as never, null, [])).toBeNull();
    expect(clipQueries).toEqual([]);
  });

  test("a transient Twitch error doesn't mark the clip dead or move on to the next one", async () => {
    download = async () => {
      throw helix429();
    };
    expect(await getNextOverlayClip(TOKEN, ITEM_ID, null, [])).toBeNull();
    expect(downloadCalls).toBe(1);

    download = async () => ({ data: [{ landscape_download_url: "https://clips.example/x.mp4" }] });
    expect((await getNextOverlayClip(TOKEN, ITEM_ID, null, []))?.videoUrl).toBe("https://clips.example/x.mp4");
  });

  test("a clip Twitch has no download for is skipped from then on", async () => {
    download = async () => ({ data: [] });
    // The mock always picks the same clip, so after it is marked dead every
    // attempt lands on a known-dead clip and no further download is tried.
    expect(await getNextOverlayClip(TOKEN, ITEM_ID, null, [])).toBeNull();
    expect(downloadCalls).toBe(1);
    expect(await getNextOverlayClip(TOKEN, ITEM_ID, null, [])).toBeNull();
    expect(downloadCalls).toBe(1);
  });

  test("limits each scene owner to 30 calls a minute", async () => {
    // Earlier tests in this file already spent some of the window.
    let served = 0;
    for (let i = 0; i < 40; i++) if (await getNextOverlayClip(TOKEN, ITEM_ID, null, [])) served++;
    expect(served).toBeGreaterThan(0);
    expect(served).toBeLessThan(30);
    expect(await getNextOverlayClip(TOKEN, ITEM_ID, null, [])).toBeNull();
  });
});
