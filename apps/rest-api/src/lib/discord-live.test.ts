import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * Drives postGoLive / endGoLive with Discord and the database mocked. The
 * cases pin down the gates (guild switch, Discord link, per-user switch),
 * the cooldown (edit instead of a second post), a deleted message on either
 * side, and that nothing ever throws out of these two.
 */

class UnknownMessage extends Error {}
class RateLimited extends Error {}

type Settings = { live_enabled: boolean; live_channel_id: string | null } | null;
type Post = {
  id: string;
  broadcaster_id: string;
  user_id: string | null;
  stream_id: string | null;
  channel_id: string;
  message_id: string;
  title: string | null;
  game_name: string | null;
  user_login: string;
  user_name: string;
  started_at: string;
  posted_at: string;
  ended_at: string | null;
};

let settings: Settings;
let identity: { userId: string; discord: { userId: string; username: string | null } | null } | null;
let preferences: { discord_live_notifications: boolean } | null;
let latest: Post | null;
let sends: [string, unknown][];
let edits: [string, string, unknown][];
let inserts: Record<string, unknown>[];
let revived: [string, Record<string, unknown>][];
let detailUpdates: [string, Record<string, unknown>][];
let ended: [string, string][];
let reported: string[];
let sendError: Error | null;
let editError: Error | null;

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
mock.module("@repo/supabase/queries/discord-live", () => ({
  getLatestLivePost: async () => latest,
  insertLivePost: async (_client: unknown, row: Record<string, unknown>) => {
    inserts.push(row);
    return { id: "row1", ...row };
  },
  markLivePostEnded: async (_client: unknown, id: string, endedAt: string) => {
    ended.push([id, endedAt]);
  },
  reviveLivePost: async (_client: unknown, id: string, patch: Record<string, unknown>) => {
    revived.push([id, patch]);
  },
  updateLivePostDetails: async (_client: unknown, id: string, patch: Record<string, unknown>) => {
    detailUpdates.push([id, patch]);
  },
}));
// Union with discord-live-role.test.ts: same process-wide mock rule.
mock.module("@repo/discord-api", () => ({
  DiscordUnknownMessageError: UnknownMessage,
  DiscordRateLimitError: RateLimited,
  DiscordMemberNotFoundError: class extends Error {},
  DiscordRoleNotFoundError: class extends Error {},
  DiscordApi: class {},
  sendDiscordChannelMessage: async (channelId: string, payload: unknown) => {
    if (sendError) throw sendError;
    sends.push([channelId, payload]);
    return { id: "m1" };
  },
  editDiscordChannelMessage: async (channelId: string, messageId: string, payload: unknown) => {
    if (editError) throw editError;
    edits.push([channelId, messageId, payload]);
    return { id: messageId };
  },
}));

process.env.DISCORD_BOT_TOKEN = "token";
process.env.DISCORD_GUILD_ID = "guild";
mock.module("./env", () => ({ env: { DISCORD_BOT_TOKEN: "token", DISCORD_GUILD_ID: "guild" } }));

let mod: typeof import("./discord-live");

beforeAll(async () => {
  mod = await import("./discord-live");
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
  thumbnail_url: "https://cdn/preview-{width}x{height}.jpg",
  tag_ids: [],
  is_mature: false,
};

const post = (overrides: Partial<Post> = {}): Post => ({
  id: "p1",
  broadcaster_id: "b1",
  user_id: "u1",
  stream_id: "s0",
  channel_id: "c1",
  message_id: "m0",
  title: "Old title",
  game_name: "Old game",
  user_login: "streamer",
  user_name: "Streamer",
  started_at: "2026-09-21T09:00:00.000Z",
  posted_at: new Date().toISOString(),
  ended_at: null,
  ...overrides,
});

beforeEach(() => {
  settings = { live_enabled: true, live_channel_id: "c1" };
  identity = { userId: "u1", discord: { userId: "d1", username: "disc" } };
  preferences = { discord_live_notifications: true };
  latest = null;
  sends = [];
  edits = [];
  inserts = [];
  revived = [];
  detailUpdates = [];
  ended = [];
  reported = [];
  sendError = null;
  editError = null;
});

describe("buildLiveMessage", () => {
  it("names the streamer without pinging, links the channel, fills the thumbnail", () => {
    const payload = mod.buildLiveMessage(
      {
        userLogin: "streamer",
        userName: "Streamer",
        title: "Title",
        gameName: "Game",
        startedAt: stream.started_at,
        thumbnailUrl: "https://cdn/preview-1280x720.jpg?t=1",
      },
      { discordUserId: "d1" },
    );

    expect(payload.content).toBe("<@d1> is live");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    const embed = payload.embeds?.[0];
    expect(embed?.url).toBe("https://twitch.tv/streamer");
    expect(embed?.image?.url).toBe("https://cdn/preview-1280x720.jpg?t=1");
    expect(embed?.color).toBe(0x9146ff);
  });

  it("falls back when the title and game are empty", () => {
    const payload = mod.buildLiveMessage(
      { userLogin: "s", userName: "S", title: null, gameName: null, startedAt: stream.started_at, thumbnailUrl: null },
      { discordUserId: "d1" },
    );
    expect(payload.embeds?.[0]?.title).toBe("Live now");
    expect(payload.embeds?.[0]?.fields?.[0]?.value).toBe("No game set");
    expect(payload.embeds?.[0]?.image).toBeUndefined();
  });
});

describe("formatStreamDuration", () => {
  it("rounds to minutes and drops empty parts", () => {
    const at = (m: number) => new Date(Date.parse(stream.started_at) + m * 60_000).toISOString();
    expect(mod.formatStreamDuration(stream.started_at, at(0))).toBe("under a minute");
    expect(mod.formatStreamDuration(stream.started_at, at(48))).toBe("48m");
    expect(mod.formatStreamDuration(stream.started_at, at(120))).toBe("2h");
    expect(mod.formatStreamDuration(stream.started_at, at(133))).toBe("2h 13m");
  });
});

describe("postGoLive", () => {
  it("posts and stores the message", async () => {
    expect(await mod.postGoLive(stream)).toBe("posted");

    expect(sends).toHaveLength(1);
    expect(sends[0]?.[0]).toBe("c1");
    expect(inserts).toEqual([
      {
        broadcaster_id: "b1",
        user_id: "u1",
        stream_id: "s1",
        channel_id: "c1",
        message_id: "m1",
        title: "Title",
        game_name: "Game",
        user_login: "streamer",
        user_name: "Streamer",
        started_at: stream.started_at,
      },
    ]);
    expect(reported).toHaveLength(0);
  });

  it("skips when the guild switch is off or has no channel", async () => {
    settings = { live_enabled: false, live_channel_id: "c1" };
    expect(await mod.postGoLive(stream)).toBe("skipped");
    settings = { live_enabled: true, live_channel_id: null };
    expect(await mod.postGoLive(stream)).toBe("skipped");
    expect(sends).toHaveLength(0);
  });

  it("skips without a linked Discord", async () => {
    identity = { userId: "u1", discord: null };
    expect(await mod.postGoLive(stream)).toBe("skipped");
    identity = null;
    expect(await mod.postGoLive(stream)).toBe("skipped");
    expect(sends).toHaveLength(0);
  });

  it("skips only when the user switched it off; a missing preferences row is on", async () => {
    preferences = { discord_live_notifications: false };
    expect(await mod.postGoLive(stream)).toBe("skipped");
    preferences = null;
    expect(await mod.postGoLive(stream)).toBe("posted");
    expect(sends).toHaveLength(1);
  });

  it("edits the previous message instead of posting inside the cooldown", async () => {
    latest = post({ ended_at: "2026-09-21T09:50:00.000Z" });
    expect(await mod.postGoLive(stream)).toBe("revived");

    expect(sends).toHaveLength(0);
    expect(edits).toHaveLength(1);
    expect(edits[0]?.slice(0, 2)).toEqual(["c1", "m0"]);
    expect(revived).toEqual([["p1", { stream_id: "s1", started_at: stream.started_at, title: "Title", game_name: "Game" }]]);
  });

  it("posts fresh once the cooldown has passed", async () => {
    latest = post({ posted_at: new Date(Date.now() - mod.LIVE_POST_COOLDOWN_MS - 1000).toISOString() });
    expect(await mod.postGoLive(stream)).toBe("posted");
    expect(edits).toHaveLength(0);
    expect(sends).toHaveLength(1);
  });

  it("posts fresh when the cooldown message was deleted", async () => {
    latest = post();
    editError = new UnknownMessage("gone");
    expect(await mod.postGoLive(stream)).toBe("posted");
    expect(revived).toHaveLength(0);
    expect(sends).toHaveLength(1);
    expect(reported).toHaveLength(0);
  });

  it("reports and resolves when Discord fails", async () => {
    sendError = new RateLimited("429");
    expect(await mod.postGoLive(stream)).toBe("skipped");
    expect(inserts).toHaveLength(0);
    expect(reported).toEqual(["eventsub.stream-online.discord-live"]);
  });
});

describe("refreshGoLive", () => {
  it("edits the open post with the new title and game", async () => {
    latest = post();
    expect(await mod.refreshGoLive("b1", { title: "New title", categoryName: "New game" })).toBe("refreshed");

    expect(edits).toHaveLength(1);
    const payload = edits[0]?.[2] as { content?: string; allowed_mentions?: unknown; embeds?: { title?: string; fields?: { value: string }[]; image?: unknown }[] };
    expect(payload.content).toBe("<@d1> is live");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds?.[0]?.title).toBe("New title");
    expect(payload.embeds?.[0]?.fields?.[0]?.value).toBe("New game");
    expect(payload.embeds?.[0]?.image).toBeDefined();
    expect(detailUpdates).toEqual([["p1", { title: "New title", game_name: "New game" }]]);
  });

  it("does nothing when nothing changed or there is no open post", async () => {
    latest = post();
    expect(await mod.refreshGoLive("b1", { title: "Old title", categoryName: "Old game" })).toBe("skipped");
    latest = post({ ended_at: "2026-09-21T09:50:00.000Z" });
    expect(await mod.refreshGoLive("b1", { title: "New", categoryName: "New" })).toBe("skipped");
    latest = null;
    expect(await mod.refreshGoLive("b1", { title: "New", categoryName: "New" })).toBe("skipped");
    expect(edits).toHaveLength(0);
    expect(detailUpdates).toHaveLength(0);
  });

  it("still records the change when the message was deleted", async () => {
    latest = post();
    editError = new UnknownMessage("gone");
    expect(await mod.refreshGoLive("b1", { title: "New", categoryName: "Old game" })).toBe("refreshed");
    expect(detailUpdates).toHaveLength(1);
    expect(reported).toHaveLength(0);
  });
});

describe("endGoLive", () => {
  it("edits the open post and marks it ended", async () => {
    latest = post();
    expect(await mod.endGoLive("b1", "2026-09-21T11:13:00.000Z")).toBe("ended");

    expect(edits).toHaveLength(1);
    const payload = edits[0]?.[2] as { content?: string; allowed_mentions?: unknown; embeds?: { footer?: { text: string } }[] };
    expect(payload.content).toBe("<@d1> was live");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds?.[0]?.footer?.text).toBe("Ended. Streamed for 2h 13m");
    expect(ended).toEqual([["p1", "2026-09-21T11:13:00.000Z"]]);
  });

  it("does nothing without an open post", async () => {
    expect(await mod.endGoLive("b1")).toBe("skipped");
    latest = post({ ended_at: "2026-09-21T09:50:00.000Z" });
    expect(await mod.endGoLive("b1")).toBe("skipped");
    expect(edits).toHaveLength(0);
    expect(ended).toHaveLength(0);
  });

  it("closes the row quietly when the message was deleted", async () => {
    latest = post();
    editError = new UnknownMessage("gone");
    expect(await mod.endGoLive("b1", "2026-09-21T11:00:00.000Z")).toBe("ended");
    expect(ended).toHaveLength(1);
    expect(reported).toHaveLength(0);
  });

  it("reports and resolves when the edit fails for another reason", async () => {
    latest = post();
    editError = new Error("boom");
    expect(await mod.endGoLive("b1")).toBe("skipped");
    expect(ended).toHaveLength(0);
    expect(reported).toEqual(["eventsub.stream-offline.discord-live"]);
  });
});
