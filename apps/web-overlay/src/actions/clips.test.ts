import { beforeEach, describe, expect, mock, test } from "bun:test";

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
        twitch_clip_id: "SomeClip-abc",
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
mock.module("@/actions/twitch", () => ({ getClipDownloadUrl: async () => "https://clips.example/x.mp4" }));

const { getNextOverlayClip } = await import("./clips");

describe("getNextOverlayClip", () => {
  beforeEach(() => {
    clipQueries = [];
    itemType = "clips_widget";
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
});
