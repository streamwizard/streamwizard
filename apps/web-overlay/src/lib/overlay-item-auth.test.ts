import { describe, expect, mock, test } from "bun:test";

const TOKEN = "c".repeat(64);
const SCENE = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222" };
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
let lookups = 0;

mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
mock.module("@repo/supabase/queries/user", () => ({ getTwitchUserIdByUserIdMaybe: async () => null }));
mock.module("@repo/supabase/queries/overlays", () => ({
  getOverlaySceneBySubscriberToken: async (_client: unknown, token: string) => {
    lookups++;
    return { data: token === TOKEN ? SCENE : null };
  },
  getOverlayItemById: async (_client: unknown, itemId: string, sceneId: string) => ({
    data: itemId === ITEM_ID && sceneId === SCENE.id ? { type: "custom_widget", config: { widget_id: "w" } } : null,
  }),
}));

const { resolveOverlayItem } = await import("./overlay-item-auth");

describe("resolveOverlayItem", () => {
  test("owner and config come from the scene behind the token", async () => {
    expect(await resolveOverlayItem(TOKEN, ITEM_ID)).toEqual({
      userId: SCENE.user_id,
      type: "custom_widget",
      config: { widget_id: "w" },
    });
  });

  test("malformed input never reaches the database", async () => {
    lookups = 0;
    expect(await resolveOverlayItem("x", ITEM_ID)).toBeNull();
    expect(await resolveOverlayItem(TOKEN, "not-a-uuid")).toBeNull();
    expect(await resolveOverlayItem(SCENE.user_id, ITEM_ID)).toBeNull();
    expect(lookups).toBe(0);
  });

  test("an item from another scene is not found", async () => {
    expect(await resolveOverlayItem(TOKEN, "44444444-4444-4444-8444-444444444444")).toBeNull();
  });
});
