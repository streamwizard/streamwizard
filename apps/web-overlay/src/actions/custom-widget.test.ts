import { beforeEach, describe, expect, mock, test } from "bun:test";

// loadCustomWidgetData runs on the service role with arguments anyone can
// send. Its input is parsed first, so a bad token, item id or field-values
// object is answered without a database call.

let dbCalls: string[] = [];

mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
// Spread the real exports: bun shares module mocks across test files.
const realOverlayQueries = await import("@repo/supabase/queries/overlays/overlays");
mock.module("@repo/supabase/queries/overlays/overlays", () => ({
  ...realOverlayQueries,
  getOverlaySceneBySubscriberToken: async () => {
    dbCalls.push("scene");
    return { data: null };
  },
  getOverlayItemById: async () => {
    dbCalls.push("item");
    return { data: null };
  },
}));
const realWidgetQueries = await import("@repo/supabase/queries/overlays/widgets");
mock.module("@repo/supabase/queries/overlays/widgets", () => ({
  ...realWidgetQueries,
  selectOverlayWidgetRuntime: async () => {
    dbCalls.push("widget");
    return { data: null, error: null };
  },
  selectWidgetInstanceFieldValues: async () => {
    dbCalls.push("instance");
    return { data: null, error: null };
  },
}));

const { loadCustomWidgetData } = await import("./custom-widget");

const TOKEN = "a".repeat(64);
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

describe("loadCustomWidgetData input", () => {
  beforeEach(() => {
    dbCalls = [];
  });

  const bad: Array<[string, unknown, unknown, unknown]> = [
    ["a short token", "abc", ITEM_ID, undefined],
    ["an upper-case token", "A".repeat(64), ITEM_ID, undefined],
    ["a non-string token", 42, ITEM_ID, undefined],
    ["an item id that isn't a guid", TOKEN, "temp-1", undefined],
    ["field values that aren't an object", TOKEN, ITEM_ID, "nope"],
    ["too many field values", TOKEN, ITEM_ID, Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, i]))],
  ];

  for (const [name, token, itemId, fieldValues] of bad) {
    test(`refuses ${name} without touching the database`, async () => {
      const result = await loadCustomWidgetData(token as string, itemId as string, fieldValues as Record<string, unknown>);
      expect(result).toEqual({ data: null, error: "Widget not found" });
      expect(dbCalls).toEqual([]);
    });
  }

  test("well-formed input goes on to the lookup", async () => {
    const result = await loadCustomWidgetData(TOKEN, ITEM_ID, { color: "red" });
    expect(result).toEqual({ data: null, error: "Widget not found" });
    expect(dbCalls).toEqual(["scene"]);
  });
});
