import { beforeEach, describe, expect, mock, test } from "bun:test";

// exportOverlayScene took its scene id straight from the caller. It now
// checks the session first and parses the id before anything reaches the
// database, so junk input costs nothing.

let signedIn = true;
let dbTouched: string[] = [];

// Any property read on this client counts as a database call.
const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      dbTouched.push(String(prop));
      throw new Error(`database touched: ${String(prop)}`);
    },
  },
);

// Spread the real exports: bun shares module mocks across test files.
const realAuth = await import("@/lib/auth");
mock.module("@/lib/auth", () => ({
  ...realAuth,
  tryAuthContext: async () => (signedIn ? { supabase, user: { id: "user-1" }, broadcasterId: "1" } : null),
}));

const { exportOverlayScene, importOverlayScene } = await import("./transfer");

describe("exportOverlayScene", () => {
  beforeEach(() => {
    signedIn = true;
    dbTouched = [];
  });

  test("refuses a signed-out caller", async () => {
    signedIn = false;
    expect(await exportOverlayScene("4a1f0c2e-8b7d-4c3a-9e5f-1d2c3b4a5e6f")).toEqual({ data: null, error: "Unauthorized" });
    expect(dbTouched).toEqual([]);
  });

  for (const bad of ["", "not-an-id", "../x", "4a1f0c2e-8b7d-4c3a-9e5f-1d2c3b4a5e6f ", 42, null, { id: "x" }]) {
    test(`returns an error for ${JSON.stringify(bad)} without touching the database`, async () => {
      const result = await exportOverlayScene(bad as unknown as string);
      expect(result).toEqual({ data: null, error: "Not found" });
      expect(dbTouched).toEqual([]);
    });
  }
});

describe("importOverlayScene", () => {
  beforeEach(() => {
    signedIn = true;
    dbTouched = [];
  });

  test("returns an error for a file that isn't JSON without touching the database", async () => {
    const result = await importOverlayScene("{not json");
    expect(result.error).toBe("That file isn't valid JSON.");
    expect(result.data).toBeNull();
    expect(dbTouched).toEqual([]);
  });
});
