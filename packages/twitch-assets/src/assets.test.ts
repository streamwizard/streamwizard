import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * resolveUsers takes ids from overlay widgets, so made-up ids reach it. Those
 * must cost one Helix lookup, not one per request: the lookup spends the app
 * token's bucket, which everything else on the app token shares.
 */

const lookups: string[][] = [];
const cacheReads: string[] = [];
const known = new Set(["1"]);

mock.module("@repo/twitch-api", () => ({
  TwitchApi: class {
    search = {
      lookupUsers: async (ids: string[]) => {
        lookups.push(ids);
        return ids
          .filter((id) => known.has(id))
          .map((id) => ({ id, login: `u${id}`, display_name: `U${id}`, profile_image_url: `https://x/${id}.png` }));
      },
    };
  },
}));

mock.module("./cache", () => ({
  ASSET_TTL: { user: 60_000 },
  getCached: async (key: string) => {
    cacheReads.push(key);
    return undefined;
  },
  setCached: async () => {},
  peekCached: async () => undefined,
  peekMemory: () => undefined,
  singleFlight: <T>(_key: string, fn: () => Promise<T>) => fn(),
}));

const { resolveUsers } = await import("./assets");

beforeEach(() => {
  lookups.length = 0;
  cacheReads.length = 0;
});

describe("resolveUsers", () => {
  test("an id Helix doesn't return is not looked up again", async () => {
    expect(Object.keys(await resolveUsers(["1", "900"]))).toEqual(["1"]);
    expect(lookups).toEqual([["1", "900"]]);

    lookups.length = 0;
    cacheReads.length = 0;
    await resolveUsers(["900"]);
    expect(lookups).toEqual([]);
    expect(cacheReads).toEqual([]);
  });

  test("allowFetch returning false skips Helix and answers from cache only", async () => {
    const users = await resolveUsers(["901"], { allowFetch: () => false });
    expect(users).toEqual({});
    expect(lookups).toEqual([]);

    // Skipped is not the same as unknown: the id is still looked up next time.
    await resolveUsers(["901"]);
    expect(lookups).toEqual([["901"]]);
  });
});
