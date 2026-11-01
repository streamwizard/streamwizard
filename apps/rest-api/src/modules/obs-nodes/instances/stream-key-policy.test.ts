import { describe, expect, it } from "bun:test";

import { resolveStreamKey } from "./stream-key-policy";

const fetchKey = async () => "live_123";

describe("resolveStreamKey", () => {
  it("has no key for a user without a Twitch integration", async () => {
    expect(await resolveStreamKey({ twitchUserId: null, scopes: null, fetchKey })).toEqual({
      key: null,
      reason: "no_integration",
    });
  });

  it("refuses a synced token that lacks the stream key scope, without calling Twitch", async () => {
    let called = false;
    const result = await resolveStreamKey({
      twitchUserId: "1",
      scopes: ["user:read:email"],
      fetchKey: async () => {
        called = true;
        return "x";
      },
    });
    expect(result).toEqual({ key: null, reason: "scope_missing" });
    expect(called).toBe(false);
  });

  it("fetches the key when the scope is granted", async () => {
    expect(await resolveStreamKey({ twitchUserId: "1", scopes: ["channel:read:stream_key"], fetchKey })).toEqual({
      key: "live_123",
      reason: "granted",
    });
  });

  it("treats an unsynced token as granted", async () => {
    expect((await resolveStreamKey({ twitchUserId: "1", scopes: null, fetchKey })).reason).toBe("granted");
  });

  it("reports a Twitch failure as error, not as a missing grant", async () => {
    const result = await resolveStreamKey({
      twitchUserId: "1",
      scopes: null,
      fetchKey: async () => {
        throw new Error("boom");
      },
    });
    expect(result).toEqual({ key: null, reason: "error" });
  });
});
