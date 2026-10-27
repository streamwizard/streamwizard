import { describe, expect, it } from "bun:test";
import {
  TWITCH_SCOPE_FEATURE_PRODUCTS,
  TWITCH_SCOPE_SETS,
  TWITCH_SCOPE_FEATURES,
  hasTwitchFeature,
  lostTwitchFeatures,
  missingTwitchScopes,
  twitchAuthorizationFeatures,
  twitchScopesFor,
} from "./twitch-scopes";

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

describe("hasTwitchFeature", () => {
  it("does not take an unsynced token as holding an on-demand set", () => {
    expect(hasTwitchFeature(null, "alert_bans")).toBe(false);
    expect(hasTwitchFeature(undefined, "alert_vips")).toBe(false);
  });

  it("needs every scope of the set", () => {
    expect(hasTwitchFeature(twitchScopesFor(["alert_bans"]), "alert_bans")).toBe(true);
    expect(hasTwitchFeature([...TWITCH_SCOPE_SETS.base], "alert_bans")).toBe(false);
  });
});

describe("twitchAuthorizationFeatures", () => {
  const base = [...TWITCH_SCOPE_SETS.base];

  it("never adds a free set nobody asked for", () => {
    expect(twitchAuthorizationFeatures({ entitled: ["cloud_obs"], granted: base, requested: "cloud_obs" })).toEqual([
      "cloud_obs",
    ]);
    expect(twitchAuthorizationFeatures({ entitled: [], granted: null, requested: "base" })).toEqual([]);
  });

  it("adds the free set being asked for", () => {
    expect(twitchAuthorizationFeatures({ entitled: [], granted: base, requested: "alert_vips" })).toEqual(["alert_vips"]);
  });

  it("keeps free sets the token already carries, so a new grant does not take them back", () => {
    const granted = twitchScopesFor(["alert_bans"]);
    expect(
      twitchAuthorizationFeatures({ entitled: ["cloud_obs"], granted, requested: "alert_mods" }).sort()
    ).toEqual(["alert_bans", "alert_mods", "cloud_obs"]);
  });

  it("does not add a product set through the request alone", () => {
    expect(twitchAuthorizationFeatures({ entitled: [], granted: base, requested: "cloud_obs" })).toEqual([]);
  });
});

describe("lostTwitchFeatures", () => {
  it("lists the sets a base-only re-login dropped", () => {
    const before = twitchScopesFor(["alert_bans", "cloud_obs"]);
    expect(lostTwitchFeatures(before, [...TWITCH_SCOPE_SETS.base]).sort()).toEqual(["alert_bans", "cloud_obs"]);
  });

  it("is empty when nothing was lost, or nothing was known before", () => {
    const both = twitchScopesFor(["alert_vips"]);
    expect(lostTwitchFeatures(both, both)).toEqual([]);
    expect(lostTwitchFeatures(null, [...TWITCH_SCOPE_SETS.base])).toEqual([]);
  });
});

describe("feature products", () => {
  it("leaves the alert sets free and keeps cloud OBS behind its product", () => {
    expect(TWITCH_SCOPE_FEATURE_PRODUCTS.cloud_obs).toBe("cloud_obs");
    for (const feature of ["alert_bans", "alert_vips", "alert_mods"] as const) {
      expect(TWITCH_SCOPE_FEATURE_PRODUCTS[feature]).toBeNull();
    }
  });
});
