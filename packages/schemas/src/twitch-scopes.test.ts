import { describe, expect, it } from "bun:test";
import { TWITCH_SCOPE_SETS, TWITCH_SCOPE_FEATURES, missingTwitchScopes, twitchScopesFor } from "./twitch-scopes";

describe("twitchScopesFor", () => {
  it("is base alone when no feature is active", () => {
    expect(twitchScopesFor([])).toEqual([...TWITCH_SCOPE_SETS.base]);
  });

  it("adds a feature set on top of base, without duplicates", () => {
    const scopes = twitchScopesFor(["cloud_obs", "cloud_obs"]);
    expect(scopes).toContain("channel:read:stream_key");
    expect(scopes.length).toBe(TWITCH_SCOPE_SETS.base.length + TWITCH_SCOPE_SETS.cloud_obs.length);
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it("never lists the same scope in base and a feature set", () => {
    const base = new Set<string>(TWITCH_SCOPE_SETS.base);
    for (const feature of TWITCH_SCOPE_FEATURES) {
      for (const scope of TWITCH_SCOPE_SETS[feature]) expect(base.has(scope)).toBe(false);
    }
  });
});

describe("missingTwitchScopes", () => {
  it("treats an unsynced token as complete", () => {
    expect(missingTwitchScopes(null, "cloud_obs")).toEqual([]);
    expect(missingTwitchScopes(undefined, "cloud_obs")).toEqual([]);
  });

  it("reports the feature scopes a synced token lacks", () => {
    expect(missingTwitchScopes([...TWITCH_SCOPE_SETS.base], "cloud_obs")).toEqual(["channel:read:stream_key"]);
    expect(missingTwitchScopes(twitchScopesFor(["cloud_obs"]), "cloud_obs")).toEqual([]);
  });

  it("ignores scopes outside the feature set", () => {
    expect(missingTwitchScopes(["channel:read:stream_key"], "cloud_obs")).toEqual([]);
  });

  it("reports base scopes a token from before they were added lacks", () => {
    const old = TWITCH_SCOPE_SETS.base.filter((scope) => scope !== "channel:read:goals");
    expect(missingTwitchScopes(old, "base")).toEqual(["channel:read:goals"]);
    expect(missingTwitchScopes([...TWITCH_SCOPE_SETS.base], "base")).toEqual([]);
  });
});
