import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * Drives grantLiveRole / revokeLiveRole / reconcileLiveRoles with Discord and
 * the database mocked. Pins down the gates (role configured, Discord linked,
 * per-user switch), that a member who left the server is a quiet skip, that
 * the sweep only touches Discord for differences, and that nothing throws.
 */

class MemberNotFound extends Error {}
class RoleNotFound extends Error {}
class UnknownMessage extends Error {}
class RateLimited extends Error {}

type Settings = { live_enabled: boolean; live_channel_id: string | null; live_role_id: string | null } | null;
type Grant = { discord_user_id: string; broadcaster_id: string; user_id: string | null; role_id: string; granted_at: string };
type Wanted = { broadcasterId: string; userId: string; discordUserId: string };

let settings: Settings;
let identity: { userId: string; discord: { userId: string; username: string | null } | null } | null;
let preferences: { discord_live_notifications: boolean; discord_live_role: boolean } | null;
let grants: Grant[];
let wanted: Wanted[];
let assigned: [string, string][];
let removed: [string, string][];
let upserts: Record<string, unknown>[];
let deletes: string[];
let reported: string[];
let assignError: ((discordUserId: string) => Error | null) | null;
let removeError: ((discordUserId: string) => Error | null) | null;

mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));
mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/discord", () => ({
  getGuildSettings: async () => settings,
}));
mock.module("@repo/supabase/queries/identity", () => ({
  getUserIdentity: async () => identity,
}));
// Same export set as viewer-count-poller.test.ts: bun's mock.module is
// process-wide, so every file mocking this module must agree on its shape.
mock.module("@repo/supabase/queries/user", () => ({
  getTwitchIntegrationByBroadcasterId: async () => null,
  getUserPreferencesByUserId: async () => preferences,
}));
mock.module("@repo/supabase/queries/discord-live-role", () => ({
  getLiveRoleGrantByBroadcaster: async (_client: unknown, broadcasterId: string) =>
    grants.find((row) => row.broadcaster_id === broadcasterId) ?? null,
  listLiveRoleGrants: async () => grants,
  listLiveLinkedBroadcasters: async () => wanted,
  upsertLiveRoleGrant: async (_client: unknown, row: Record<string, unknown>) => {
    upserts.push(row);
  },
  deleteLiveRoleGrant: async (_client: unknown, discordUserId: string) => {
    deletes.push(discordUserId);
  },
}));
// Union of what discord-live.test.ts mocks and what this module needs, for
// the same process-wide reason.
mock.module("@repo/discord-api", () => ({
  DiscordMemberNotFoundError: MemberNotFound,
  DiscordRoleNotFoundError: RoleNotFound,
  DiscordUnknownMessageError: UnknownMessage,
  DiscordRateLimitError: RateLimited,
  DiscordApi: class {
    members = {
      assignRole: async (discordUserId: string, roleId: string) => {
        const error = assignError?.(discordUserId);
        if (error) throw error;
        assigned.push([discordUserId, roleId]);
      },
      removeRole: async (discordUserId: string, roleId: string) => {
        const error = removeError?.(discordUserId);
        if (error) throw error;
        removed.push([discordUserId, roleId]);
      },
    };
  },
  sendDiscordChannelMessage: async () => ({ id: "m1" }),
  editDiscordChannelMessage: async (_c: string, messageId: string) => ({ id: messageId }),
}));

process.env.DISCORD_BOT_TOKEN = "token";
process.env.DISCORD_GUILD_ID = "guild";
mock.module("./env", () => ({ env: { DISCORD_BOT_TOKEN: "token", DISCORD_GUILD_ID: "guild" } }));

let mod: typeof import("./discord-live-role");

beforeAll(async () => {
  mod = await import("./discord-live-role");
});

const stream = {
  id: "s1",
  user_id: "b1",
  user_login: "streamer",
  user_name: "Streamer",
  game_id: "g",
  game_name: "Game",
  type: "live",
  title: "Title",
  tags: [],
  viewer_count: 0,
  started_at: "2026-09-21T10:00:00.000Z",
  language: "en",
  thumbnail_url: "",
  tag_ids: [],
  is_mature: false,
};

const grant = (overrides: Partial<Grant> = {}): Grant => ({
  discord_user_id: "d1",
  broadcaster_id: "b1",
  user_id: "u1",
  role_id: "r1",
  granted_at: "2026-09-21T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  settings = { live_enabled: false, live_channel_id: null, live_role_id: "r1" };
  identity = { userId: "u1", discord: { userId: "d1", username: "disc" } };
  preferences = { discord_live_notifications: true, discord_live_role: true };
  grants = [];
  wanted = [];
  assigned = [];
  removed = [];
  upserts = [];
  deletes = [];
  reported = [];
  assignError = null;
  removeError = null;
});

describe("grantLiveRole", () => {
  it("assigns the role and records it", async () => {
    expect(await mod.grantLiveRole(stream)).toBe("granted");
    expect(assigned).toEqual([["d1", "r1"]]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ discord_user_id: "d1", broadcaster_id: "b1", user_id: "u1", role_id: "r1" });
    expect(reported).toHaveLength(0);
  });

  it("runs with go-live posts off: the role is its own switch", async () => {
    settings = { live_enabled: false, live_channel_id: null, live_role_id: "r1" };
    expect(await mod.grantLiveRole(stream)).toBe("granted");
  });

  it("skips without a configured role or guild row", async () => {
    settings = { live_enabled: true, live_channel_id: "c1", live_role_id: null };
    expect(await mod.grantLiveRole(stream)).toBe("skipped");
    settings = null;
    expect(await mod.grantLiveRole(stream)).toBe("skipped");
    expect(assigned).toHaveLength(0);
  });

  it("skips without a linked Discord", async () => {
    identity = { userId: "u1", discord: null };
    expect(await mod.grantLiveRole(stream)).toBe("skipped");
    expect(assigned).toHaveLength(0);
  });

  it("skips only when the user switched the role off; the post switch is separate", async () => {
    preferences = { discord_live_notifications: true, discord_live_role: false };
    expect(await mod.grantLiveRole(stream)).toBe("skipped");
    preferences = { discord_live_notifications: false, discord_live_role: true };
    expect(await mod.grantLiveRole(stream)).toBe("granted");
    preferences = null;
    expect(await mod.grantLiveRole(stream)).toBe("granted");
  });

  it("takes a pre-resolved target", async () => {
    identity = null;
    const target = {
      guildId: "guild",
      settings: { live_role_id: "r1" } as never,
      userId: "u1",
      discordUserId: "d9",
      preferences: null,
    };
    expect(await mod.grantLiveRole(stream, target)).toBe("granted");
    expect(assigned).toEqual([["d9", "r1"]]);
    expect(await mod.grantLiveRole(stream, null)).toBe("skipped");
  });

  it("is quiet when the user isn't in the server, and drops any stale record", async () => {
    assignError = () => new MemberNotFound();
    expect(await mod.grantLiveRole(stream)).toBe("skipped");
    expect(deletes).toEqual(["d1"]);
    expect(upserts).toHaveLength(0);
    expect(reported).toHaveLength(0);
  });

  it("reports and resolves when Discord fails", async () => {
    assignError = () => new Error("boom");
    expect(await mod.grantLiveRole(stream)).toBe("skipped");
    expect(reported).toEqual(["eventsub.stream-online.discord-live-role"]);
  });
});

describe("revokeLiveRole", () => {
  it("removes the recorded role and forgets it", async () => {
    grants = [grant()];
    expect(await mod.revokeLiveRole("b1")).toBe("revoked");
    expect(removed).toEqual([["d1", "r1"]]);
    expect(deletes).toEqual(["d1"]);
  });

  it("does nothing without a record", async () => {
    expect(await mod.revokeLiveRole("b1")).toBe("skipped");
    expect(removed).toHaveLength(0);
  });

  it("counts a member who left or a deleted role as removed", async () => {
    grants = [grant()];
    removeError = () => new MemberNotFound();
    expect(await mod.revokeLiveRole("b1")).toBe("revoked");
    removeError = () => new RoleNotFound();
    expect(await mod.revokeLiveRole("b1")).toBe("revoked");
    expect(deletes).toEqual(["d1", "d1"]);
    expect(reported).toHaveLength(0);
  });

  it("keeps the record when Discord fails, so the sweep retries", async () => {
    grants = [grant()];
    removeError = () => new Error("boom");
    expect(await mod.revokeLiveRole("b1")).toBe("skipped");
    expect(deletes).toHaveLength(0);
    expect(reported).toEqual(["eventsub.stream-offline.discord-live-role"]);
  });
});

describe("reconcileLiveRoles", () => {
  it("leaves Discord alone when everything matches", async () => {
    grants = [grant()];
    wanted = [{ broadcasterId: "b1", userId: "u1", discordUserId: "d1" }];
    expect(await mod.reconcileLiveRoles()).toEqual({ granted: 0, revoked: 0, moved: 0, failed: 0 });
    expect(assigned).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it("grants to the live who lack it and revokes from the offline who hold it", async () => {
    grants = [grant({ discord_user_id: "d1", broadcaster_id: "b1" })];
    wanted = [{ broadcasterId: "b2", userId: "u2", discordUserId: "d2" }];
    expect(await mod.reconcileLiveRoles()).toEqual({ granted: 1, revoked: 1, moved: 0, failed: 0 });
    expect(removed).toEqual([["d1", "r1"]]);
    expect(deletes).toEqual(["d1"]);
    expect(assigned).toEqual([["d2", "r1"]]);
    expect(upserts[0]).toMatchObject({ discord_user_id: "d2", broadcaster_id: "b2", user_id: "u2", role_id: "r1" });
  });

  it("moves holders to a newly picked role", async () => {
    grants = [grant({ role_id: "old" })];
    wanted = [{ broadcasterId: "b1", userId: "u1", discordUserId: "d1" }];
    expect(await mod.reconcileLiveRoles()).toEqual({ granted: 0, revoked: 0, moved: 1, failed: 0 });
    expect(removed).toEqual([["d1", "old"]]);
    expect(assigned).toEqual([["d1", "r1"]]);
    expect(upserts[0]).toMatchObject({ discord_user_id: "d1", role_id: "r1" });
  });

  it("takes every role back once the guild clears the setting", async () => {
    settings = { live_enabled: false, live_channel_id: null, live_role_id: null };
    grants = [grant({ discord_user_id: "d1" }), grant({ discord_user_id: "d2", broadcaster_id: "b2" })];
    wanted = [{ broadcasterId: "b1", userId: "u1", discordUserId: "d1" }];
    expect(await mod.reconcileLiveRoles()).toEqual({ granted: 0, revoked: 2, moved: 0, failed: 0 });
    expect(removed).toEqual([
      ["d1", "r1"],
      ["d2", "r1"],
    ]);
    expect(assigned).toHaveLength(0);
  });

  it("counts and reports one member's failure without stopping the rest", async () => {
    wanted = [
      { broadcasterId: "b1", userId: "u1", discordUserId: "d1" },
      { broadcasterId: "b2", userId: "u2", discordUserId: "d2" },
    ];
    assignError = (id) => (id === "d1" ? new Error("boom") : null);
    expect(await mod.reconcileLiveRoles()).toEqual({ granted: 1, revoked: 0, moved: 0, failed: 1 });
    expect(assigned).toEqual([["d2", "r1"]]);
    expect(reported).toEqual(["discord-live-role: reconcile grant"]);
  });

  it("doesn't count someone who left the server as granted", async () => {
    wanted = [{ broadcasterId: "b1", userId: "u1", discordUserId: "d1" }];
    assignError = () => new MemberNotFound();
    expect(await mod.reconcileLiveRoles()).toEqual({ granted: 0, revoked: 0, moved: 0, failed: 0 });
    expect(upserts).toHaveLength(0);
  });
});
