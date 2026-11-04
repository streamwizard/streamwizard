import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// resolveBroadcasterId decides which Twitch channel a signed-in user acts as,
// including for service-role work like account deletion. It must only use
// values the user cannot edit: user_metadata is writable through
// supabase.auth.updateUser, identity_data is written by GoTrue from Twitch.

let fallbackLookups: string[];
let integrationTwitchId: string | null;

// Spread the real exports: bun shares module mocks across test files.
const realUserQueries = await import("@repo/supabase/queries/user");
mock.module("@repo/supabase/queries/user", () => ({
  ...realUserQueries,
  getTwitchUserIdByUserIdMaybe: async (_client: unknown, userId: string) => {
    fallbackLookups.push(userId);
    return integrationTwitchId;
  },
}));

// Other test files mock "@/lib/auth" and bun shares module mocks across files,
// so load this file under its own specifier to get the real module.
const realAuthSpecifier = "./auth?real";
const { resolveBroadcasterId } = (await import(realAuthSpecifier)) as typeof import("./auth");

const client = {} as SupabaseClient;

function userWith(parts: { identities?: User["identities"]; user_metadata?: Record<string, unknown> }): User {
  return {
    id: "user-1",
    app_metadata: {},
    user_metadata: parts.user_metadata ?? {},
    aud: "authenticated",
    created_at: "2026-11-04T00:00:00Z",
    identities: parts.identities,
  } as User;
}

function twitchIdentity(identityData: Record<string, unknown>) {
  return {
    id: "identity-1",
    identity_id: "identity-1",
    user_id: "user-1",
    provider: "twitch",
    identity_data: identityData,
    created_at: "2026-11-04T00:00:00Z",
    last_sign_in_at: "2026-11-04T00:00:00Z",
    updated_at: "2026-11-04T00:00:00Z",
  };
}

beforeEach(() => {
  fallbackLookups = [];
  integrationTwitchId = null;
});

describe("resolveBroadcasterId", () => {
  test("uses the Twitch identity's provider_id", async () => {
    const user = userWith({ identities: [twitchIdentity({ provider_id: "1001", sub: "1001" })] });
    expect(await resolveBroadcasterId(client, user)).toBe("1001");
    expect(fallbackLookups).toEqual([]);
  });

  test("ignores a forged user_metadata.sub when there is a Twitch identity", async () => {
    const user = userWith({
      identities: [twitchIdentity({ provider_id: "1001" })],
      user_metadata: { sub: "9999", provider_id: "9999" },
    });
    expect(await resolveBroadcasterId(client, user)).toBe("1001");
  });

  test("falls back to identity_data.sub when provider_id is missing", async () => {
    const user = userWith({ identities: [twitchIdentity({ sub: "1001" })] });
    expect(await resolveBroadcasterId(client, user)).toBe("1001");
  });

  test("without a Twitch identity, a forged user_metadata.sub is never used", async () => {
    integrationTwitchId = "2002";
    const user = userWith({ identities: [], user_metadata: { sub: "9999", provider_id: "9999" } });
    expect(await resolveBroadcasterId(client, user)).toBe("2002");
    expect(fallbackLookups).toEqual(["user-1"]);
  });

  test("without a Twitch identity or integration there is no channel", async () => {
    const user = userWith({ user_metadata: { sub: "9999" } });
    expect(await resolveBroadcasterId(client, user)).toBeNull();
  });

  test("a non-Twitch identity is not a channel", async () => {
    integrationTwitchId = null;
    const discord = { ...twitchIdentity({ provider_id: "3003" }), provider: "discord" };
    const user = userWith({ identities: [discord] });
    expect(await resolveBroadcasterId(client, user)).toBeNull();
    expect(fallbackLookups).toEqual(["user-1"]);
  });

  test("an empty provider_id falls back to the integration row", async () => {
    integrationTwitchId = "2002";
    const user = userWith({ identities: [twitchIdentity({ provider_id: "" })] });
    expect(await resolveBroadcasterId(client, user)).toBe("2002");
  });
});
