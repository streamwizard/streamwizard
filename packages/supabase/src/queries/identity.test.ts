import { describe, expect, test } from "bun:test";
import { identityAvatarUrl, identityDisplayName, type UserIdentity } from "./identity";
import { toPlatformEventIdentity } from "./platform-events";

const base: UserIdentity = {
  userId: "u1",
  name: "Test Streamer",
  email: "test@example.com",
  avatarUrl: "https://cdn.example/avatar.png",
  twitch: null,
  discord: null,
};

const withTwitch: UserIdentity = {
  ...base,
  twitch: {
    userId: "424242",
    username: "smoketester",
    profileImageUrl: "https://static-cdn.jtvnw.net/x.png",
    broadcasterType: "affiliate",
  },
  discord: { userId: "123456789012345678", username: "smoke" },
};

describe("identity mappers", () => {
  test("display name only without Twitch, and never the email fallback", () => {
    expect(identityDisplayName(base)).toBe("Test Streamer");
    expect(identityDisplayName({ ...base, name: "test@example.com" })).toBeNull();
    expect(identityDisplayName({ ...base, name: "  " })).toBeNull();
    expect(identityDisplayName(withTwitch)).toBeNull();
  });

  test("avatar prefers the Twitch picture", () => {
    expect(identityAvatarUrl(base)).toBe("https://cdn.example/avatar.png");
    expect(identityAvatarUrl(withTwitch)).toBe("https://static-cdn.jtvnw.net/x.png");
    expect(identityAvatarUrl({ ...base, avatarUrl: null })).toBeNull();
  });

  test("platform event identity carries no email", () => {
    const identity = toPlatformEventIdentity(withTwitch);
    expect(identity).toEqual({
      display_name: null,
      avatar_url: "https://static-cdn.jtvnw.net/x.png",
      twitch_username: "smoketester",
      twitch_user_id: "424242",
      discord_user_id: "123456789012345678",
    });
    expect(JSON.stringify(identity)).not.toContain("@");
    expect(toPlatformEventIdentity(null)).toEqual({
      display_name: null,
      avatar_url: null,
      twitch_username: null,
      twitch_user_id: null,
      discord_user_id: null,
    });
  });
});
