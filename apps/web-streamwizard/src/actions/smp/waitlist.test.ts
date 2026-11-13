import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// The two SMP waitlist actions are public POST endpoints. Before anything
// reaches the database, Discord or Mojang they check the session and parse the
// input. What happens after that is covered in server/smp/apply.test.ts.

let signedIn = true;
let touched: string[] = [];

// Any property read on this client counts as a database call.
const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      touched.push(String(prop));
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

const realFetch = globalThis.fetch;
const { joinSmpWaitlist, updateSmpMinecraftName } = await import("./waitlist");

const VALID = { minecraftUsername: "Steve_01", averageViewers: 12, streamLanguage: "nl", streamFrequency: "weekly" };

describe("SMP waitlist actions", () => {
  beforeEach(() => {
    signedIn = true;
    touched = [];
    globalThis.fetch = mock(async () => {
      touched.push("fetch");
      throw new Error("network touched");
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("refuse a signed-out caller", async () => {
    signedIn = false;
    expect(await joinSmpWaitlist(VALID)).toEqual({ success: false, error: "Sign in first." });
    expect(await updateSmpMinecraftName({ minecraftUsername: "Steve_01" })).toEqual({
      success: false,
      error: "Sign in first.",
    });
    expect(touched).toEqual([]);
  });

  for (const bad of [
    null,
    "Steve_01",
    {},
    { ...VALID, minecraftUsername: "no spaces allowed" },
    { ...VALID, averageViewers: "12" },
    { ...VALID, averageViewers: -5 },
    { ...VALID, streamLanguage: "klingon" },
    { ...VALID, streamFrequency: undefined },
  ]) {
    test(`joinSmpWaitlist turns down ${JSON.stringify(bad)} without a lookup`, async () => {
      const result = await joinSmpWaitlist(bad);
      expect(result.success).toBe(false);
      expect(touched).toEqual([]);
      });
  }

  for (const bad of [null, {}, { minecraftUsername: "ab" }, { minecraftUsername: "../../x" }, { minecraftUsername: 7 }]) {
    test(`updateSmpMinecraftName turns down ${JSON.stringify(bad)} without a lookup`, async () => {
      const result = await updateSmpMinecraftName(bad);
      expect(result.success).toBe(false);
      expect(touched).toEqual([]);
      });
  }

  test("the error for a bad name is the schema's own sentence", async () => {
    expect(await updateSmpMinecraftName({ minecraftUsername: "a b" })).toEqual({
      success: false,
      error: "A Minecraft name is 3 to 16 letters, numbers or underscores.",
    });
  });
});
