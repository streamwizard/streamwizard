import { describe, expect, mock, test } from "bun:test";

/**
 * The widget API rate limiter was a plain Map keyed by any token string an
 * unauthenticated caller sent, so junk tokens grew memory without limit. Only
 * tokens in the real subscriber_token format may reach it now.
 */

mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
mock.module("@repo/supabase/queries/user", () => ({ getTwitchUserIdByUserIdMaybe: async () => null }));
mock.module("@repo/supabase/queries/overlays", () => ({
  getOverlaySceneBySubscriberToken: async () => ({ data: null }),
}));

const { isPlausibleToken, isRateLimited, isUsersLookupLimited, takeUsersHelixBudget } = await import("./widget-api");

const token = (fill: string) => fill.repeat(64);

describe("isPlausibleToken", () => {
  test("accepts 64 lowercase hex, the subscriber_token format", () => {
    expect(isPlausibleToken("0123456789abcdef".repeat(4))).toBe(true);
  });

  test("rejects everything else, including huge strings", () => {
    for (const value of [undefined, null, 42, "", "abc", token("A"), token("g"), token("a") + "0", "x".repeat(1_000_000)]) {
      expect(isPlausibleToken(value)).toBe(false);
    }
  });
});

describe("isRateLimited", () => {
  test("an implausible token is refused without being counted", () => {
    expect(isRateLimited("not-a-token")).toBe(true);
  });

  test("allows 60 requests a minute per token, then limits", () => {
    const t = token("b");
    for (let i = 0; i < 60; i++) expect(isRateLimited(t)).toBe(false);
    expect(isRateLimited(t)).toBe(true);
    expect(isRateLimited(token("c"))).toBe(false);
  });
});

describe("isUsersLookupLimited", () => {
  test("allows 60 user lookups a minute per channel, whatever token they came in on", () => {
    for (let i = 0; i < 60; i++) expect(isUsersLookupLimited("111")).toBe(false);
    expect(isUsersLookupLimited("111")).toBe(true);
    expect(isUsersLookupLimited("222")).toBe(false);
  });
});

describe("takeUsersHelixBudget", () => {
  test("hands out 120 Helix batches a minute for the whole instance, then refuses", () => {
    for (let i = 0; i < 120; i++) expect(takeUsersHelixBudget()).toBe(true);
    expect(takeUsersHelixBudget()).toBe(false);
  });
});
