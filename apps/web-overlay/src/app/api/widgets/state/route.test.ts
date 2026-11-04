import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

/**
 * /api/widgets/state is called by sandboxed widget code with the scene's
 * subscriber token. The body is size-capped and parsed before any lookup, the
 * item id must be a UUID, the token shares the widget API rate limit, and a
 * failed query answers with a generic message.
 */

const SCENE = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222" };
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const INSTANCE_ID = "44444444-4444-4444-8444-444444444444";

let tokenCounter = 0;
/** A fresh token per test, so the per-token rate limit doesn't carry over. */
function freshToken() {
  tokenCounter++;
  return tokenCounter.toString(16).padStart(64, "0");
}

let sceneLookups: string[];
let updates: { instanceId: string; state: unknown }[];
let sceneError: { message: string } | null;
let updateError: { message: string } | null;
let reported: string[];

mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));
// Spread the real exports: bun shares module mocks across test files, so a
// mock with only these functions breaks later files that import others.
const realOverlayQueries = await import("@repo/supabase/queries/overlays/overlays");
const realWidgetQueries = await import("@repo/supabase/queries/overlays/widgets");
mock.module("@repo/supabase/queries/overlays/overlays", () => ({
  ...realOverlayQueries,
  getOverlaySceneBySubscriberToken: async (_client: unknown, token: string) => {
    sceneLookups.push(token);
    return sceneError ? { data: null, error: sceneError } : { data: SCENE, error: null };
  },
  overlayItemBelongsToScene: async (_client: unknown, itemId: string, sceneId: string) =>
    itemId === ITEM_ID && sceneId === SCENE.id,
}));
mock.module("@repo/supabase/queries/overlays/widgets", () => ({
  ...realWidgetQueries,
  selectWidgetInstanceStateByItem: async () => ({
    data: { id: INSTANCE_ID, widget_state: { deaths: 3 } },
    error: null,
  }),
  updateWidgetInstanceState: async (_client: unknown, instanceId: string, state: unknown) => {
    updates.push({ instanceId, state });
    return { error: updateError };
  },
}));

const { GET, POST } = await import("./route");
const { MAX_WIDGET_STATE_BODY_BYTES, MAX_WIDGET_STATE_BYTES } = await import("@/schemas/widget-state");

const URL_BASE = "https://overlay.test/api/widgets/state";

function post(body: string, token = freshToken()) {
  return POST(
    new NextRequest(URL_BASE, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body,
    })
  );
}

function get(itemId: string, token = freshToken()) {
  return GET(
    new NextRequest(`${URL_BASE}?itemId=${encodeURIComponent(itemId)}`, {
      headers: { authorization: `Bearer ${token}` },
    })
  );
}

beforeEach(() => {
  sceneLookups = [];
  updates = [];
  sceneError = null;
  updateError = null;
  reported = [];
});

describe("POST /api/widgets/state", () => {
  test("stores a valid state object", async () => {
    const res = await post(JSON.stringify({ itemId: ITEM_ID, state: { deaths: 4, names: ["a"] } }));
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ instanceId: INSTANCE_ID, state: { deaths: 4, names: ["a"] } }]);
  });

  test("refuses a body over the cap before parsing or looking anything up", async () => {
    const res = await post("x".repeat(MAX_WIDGET_STATE_BODY_BYTES + 1));
    expect(res.status).toBe(413);
    expect(sceneLookups).toEqual([]);
  });

  test("refuses a state over the serialized cap", async () => {
    const state = { blob: "x".repeat(MAX_WIDGET_STATE_BYTES) };
    const res = await post(JSON.stringify({ itemId: ITEM_ID, state }));
    expect(res.status).toBe(413);
    expect(updates).toEqual([]);
  });

  test("refuses invalid JSON, including a bare null", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post("null")).status).toBe(400);
  });

  test("refuses a bad item id or state shape without a lookup", async () => {
    const bad = [
      { itemId: "not-a-uuid", state: {} },
      { itemId: ITEM_ID },
      { itemId: ITEM_ID, state: null },
      { itemId: ITEM_ID, state: [1, 2] },
      { itemId: ITEM_ID, state: "text" },
      { itemId: ITEM_ID, state: { ["k".repeat(65)]: 1 } },
      { state: {} },
    ];
    for (const body of bad) {
      const res = await post(JSON.stringify(body));
      expect(res.status).toBe(400);
    }
    expect(sceneLookups).toEqual([]);
    expect(updates).toEqual([]);
  });

  test("stores only the parsed fields", async () => {
    const res = await post(JSON.stringify({ itemId: ITEM_ID, state: { a: 1 }, extra: "ignored" }));
    expect(res.status).toBe(200);
    expect(updates[0]?.state).toEqual({ a: 1 });
  });

  test("answers 403 for a token in the wrong format", async () => {
    const res = await post(JSON.stringify({ itemId: ITEM_ID, state: {} }), "not-a-token");
    expect(res.status).toBe(403);
    expect(sceneLookups).toEqual([]);
  });

  test("answers 429 once the token is over the shared limit", async () => {
    const token = freshToken();
    const body = JSON.stringify({ itemId: ITEM_ID, state: {} });
    for (let i = 0; i < 60; i++) expect((await post(body, token)).status).toBe(200);
    expect((await post(body, token)).status).toBe(429);
  });

  test("a failed update returns a generic message and is reported", async () => {
    updateError = { message: 'relation "overlay_widget_instances" violates something' };
    const res = await post(JSON.stringify({ itemId: ITEM_ID, state: { a: 1 } }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to save state" });
    expect(reported).toEqual(["widget-state.write"]);
  });

  test("an item outside the token's scene is refused", async () => {
    const res = await post(JSON.stringify({ itemId: INSTANCE_ID, state: {} }));
    expect(res.status).toBe(403);
    expect(updates).toEqual([]);
  });
});

describe("GET /api/widgets/state", () => {
  test("returns the stored state", async () => {
    const res = await get(ITEM_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: { deaths: 3 } });
  });

  test("refuses a non-UUID item id without a lookup", async () => {
    const res = await get("temp-123");
    expect(res.status).toBe(400);
    expect(sceneLookups).toEqual([]);
  });

  test("a failed lookup returns a generic message and is reported", async () => {
    sceneError = { message: "connection refused" };
    const res = await get(ITEM_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to read state" });
    expect(reported).toEqual(["widget-state.read"]);
  });

  test("answers 429 once the token is over the shared limit", async () => {
    const token = freshToken();
    for (let i = 0; i < 60; i++) expect((await get(ITEM_ID, token)).status).toBe(200);
    expect((await get(ITEM_ID, token)).status).toBe(429);
  });
});
