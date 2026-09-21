import { describe, expect, test } from "bun:test";
import { PLATFORM_EVENT_TYPES } from "@repo/types";
import type { PlatformEvent } from "@repo/supabase/queries/platform-events";
import { DANGER_RED, TWITCH_PURPLE } from "../branding";
import { FORMATTERS, formatPlatformEvent, formatSettingValue } from "./formatters";

function event(
  event_type: string,
  payload: PlatformEvent["payload"],
  extra: Partial<PlatformEvent> = {},
): PlatformEvent {
  return {
    id: 42,
    event_type,
    payload,
    actor_user_id: null,
    subject_user_id: null,
    created_at: "2026-09-14T12:00:00.000Z",
    status: "pending",
    attempts: 1,
    next_attempt_at: "2026-09-14T12:00:00.000Z",
    locked_until: null,
    delivered_at: null,
    discord_message_id: null,
    last_error: null,
    ...extra,
  };
}

const AVATAR = "https://static-cdn.jtvnw.net/jtv_user_pictures/logtester-profile_image.png";
const identity = {
  twitch_username: "logtester",
  twitch_user_id: "999000111",
  discord_user_id: "123456789012345678",
  avatar_url: AVATAR,
};

const fieldValue = (embed: ReturnType<ReturnType<typeof formatPlatformEvent>["toJSON"]>, name: string) =>
  embed.fields?.find((f) => f.name === name)?.value;

describe("log channel formatters", () => {
  test("every registered event type has a formatter", () => {
    for (const type of PLATFORM_EVENT_TYPES) expect(typeof FORMATTERS[type]).toBe("function");
  });

  test("every type renders with an empty payload", () => {
    for (const type of PLATFORM_EVENT_TYPES) {
      const embed = formatPlatformEvent(event(type, {})).toJSON();
      expect(embed.title).toBeTruthy();
      expect(embed.footer?.text).toBe("StreamWizard log · Event #42");
      expect(JSON.stringify(embed)).not.toContain("—");
    }
  });

  test("eventsub connection lost: reason, close code and keepalive silence, no author", () => {
    const embed = formatPlatformEvent(
      event("eventsub.connection_lost", {
        service: "streamwizard-bot",
        reason: "keepalive timeout",
        close_code: null,
        keepalive_silent_ms: 15_000,
      }),
    ).toJSON();
    expect(embed.title).toBe("🔴 EventSub connection lost");
    expect(embed.color).toBe(DANGER_RED);
    expect(embed.author).toBeUndefined();
    expect(embed.description).toContain("**streamwizard-bot** lost its EventSub connection");
    expect(fieldValue(embed, "Reason")).toBe("keepalive timeout");
    expect(fieldValue(embed, "Close code")).toBeUndefined();
    expect(fieldValue(embed, "Silent for")).toBe("15s");
  });

  test("eventsub reconnected: downtime, attempts and session", () => {
    const embed = formatPlatformEvent(
      event("eventsub.reconnected", { service: "streamwizard-bot", session_id: "AQoQ1", downtime_ms: 73_400, attempts: 3 }),
    ).toJSON();
    expect(embed.title).toBe("🟢 EventSub reconnected");
    expect(embed.color).toBe(TWITCH_PURPLE);
    expect(embed.description).toContain("after 1m 13s");
    expect(fieldValue(embed, "Down for")).toBe("1m 13s");
    expect(fieldValue(embed, "Attempts")).toBe("3");
    expect(fieldValue(embed, "Session")).toBe("`AQoQ1`");
  });

  test("new user: avatar as author icon and thumbnail, Twitch link, Discord mention, no email", () => {
    const embed = formatPlatformEvent(event("user.created", { ...identity, email: "x@example.com" })).toJSON();
    expect(embed.title).toBe("👋 New user");
    expect(embed.color).toBe(TWITCH_PURPLE);
    expect(embed.timestamp).toBe("2026-09-14T12:00:00.000Z");
    expect(embed.author).toEqual({ name: "logtester", icon_url: AVATAR, url: "https://twitch.tv/logtester" });
    expect(embed.thumbnail?.url).toBe(AVATAR);
    expect(embed.description).toBe("**logtester** just signed up for StreamWizard.");
    expect(fieldValue(embed, "Twitch")).toBe("[logtester](https://twitch.tv/logtester)");
    expect(fieldValue(embed, "Twitch ID")).toBe("`999000111`");
    expect(fieldValue(embed, "Discord")).toBe("<@123456789012345678>");
    expect(JSON.stringify(embed)).not.toContain("x@example.com");
  });

  test("non-https avatars are ignored", () => {
    const embed = formatPlatformEvent(
      event("user.created", { ...identity, avatar_url: "http://evil.example/a.png" }),
    ).toJSON();
    expect(embed.thumbnail).toBeUndefined();
    expect(embed.author?.icon_url).toBeUndefined();
  });

  test("destructive events are red", () => {
    for (const type of ["user.deleted", "discord.unlinked", "subscription.revoked"]) {
      expect(formatPlatformEvent(event(type, identity)).toJSON().color).toBe(DANGER_RED);
    }
  });

  test("plan revoked names the user and the admin", () => {
    const embed = formatPlatformEvent(
      event("subscription.revoked", {
        ...identity,
        product_id: "cloud_obs",
        plan_id: "cloud_obs_1080p_60",
        plan_name: "Cloud OBS 1080p60",
        status: "canceled",
        actor_twitch_username: "jochem",
      }),
    ).toJSON();
    expect(embed.description).toBe("**logtester** lost **Cloud OBS 1080p60**.");
    expect(embed.author?.name).toBe("logtester");
    expect(fieldValue(embed, "Revoked by")).toBe("[jochem](https://twitch.tv/jochem)");
    expect(fieldValue(embed, "Product")).toBe("`cloud_obs`");
    expect(fieldValue(embed, "Status")).toBe("Canceled");
  });

  test("plan events name a user without Twitch", () => {
    const withName = formatPlatformEvent(
      event("subscription.revoked", {
        display_name: "Test Streamer",
        product_id: "cloud_obs",
        plan_id: "cloud_obs_1080p_60",
      }),
    ).toJSON();
    expect(withName.description).toBe("**Test Streamer** lost **cloud\\_obs\\_1080p\\_60**.");
    expect(fieldValue(withName, "Account")).toBe("Test Streamer");

    const byId = formatPlatformEvent(
      event(
        "subscription.granted",
        { product_id: "cloud_obs", plan_id: "p" },
        { subject_user_id: "b61c3ff6-d65f-4d62-8479-642747eda7a4" },
      ),
    ).toJSON();
    expect(fieldValue(byId, "User ID")).toBe("`b61c3ff6-d65f-4d62-8479-642747eda7a4`");
  });

  test("usernames that aren't Twitch logins are escaped, not linked", () => {
    const embed = formatPlatformEvent(event("user.created", { twitch_username: "evil](https://x.com)" })).toJSON();
    expect(JSON.stringify(embed)).not.toContain("](https://x.com)](");
    expect(embed.author?.url).toBeUndefined();
  });

  test("setting changes: admin as author, ids as mentions", () => {
    const embed = formatPlatformEvent(
      event("discord_settings.changed", {
        guild_id: "1",
        section: "welcome",
        action: "update",
        actor_twitch_username: "jochem",
        actor_avatar_url: AVATAR,
        changes: {
          welcome_channel_id: { from: null, to: "223456789012345678" },
          welcome_enabled: { from: false, to: true },
        },
      }),
    ).toJSON();
    expect(embed.author).toEqual({ name: "jochem", icon_url: AVATAR, url: "https://twitch.tv/jochem" });
    expect(embed.description).toContain("**jochem** changed the **welcome** settings.");
    expect(embed.description).toContain("**Welcome channel id** none → <#223456789012345678>");
    expect(embed.description).toContain("**Welcome enabled** off → on");
  });

  test("formatSettingValue handles roles, lists and plain values", () => {
    expect(formatSettingValue("role_ids", ["323456789012345678"])).toBe("<@&323456789012345678>");
    expect(formatSettingValue("log_disabled_event_types", [])).toBe("none");
    expect(formatSettingValue("log_disabled_event_types", ["user.created"])).toBe("`user.created`");
  });

  test("account deleted says why", () => {
    const requested = formatPlatformEvent(event("user.deleted", { ...identity, reason: "requested" })).toJSON();
    expect(requested.description).toBe("Removed **logtester**'s account and data.");
    expect(fieldValue(requested, "Reason")).toBe("Requested");

    const revoked = formatPlatformEvent(event("user.deleted", { ...identity, reason: "twitch_revoked" })).toJSON();
    expect(revoked.description).toContain("They disconnected StreamWizard on Twitch.");
    expect(fieldValue(revoked, "Reason")).toBe("Twitch revoked");
  });

  test("admin roles: granted purple, revoked red, by the database", () => {
    const granted = formatPlatformEvent(event("admin.role_granted", { ...identity, role: "admin" })).toJSON();
    expect(granted.title).toBe("🛡️ Admin role granted");
    expect(granted.color).toBe(TWITCH_PURPLE);
    expect(granted.description).toBe("**logtester** is now **admin**.");
    expect(fieldValue(granted, "By")).toBe("Database");

    const revoked = formatPlatformEvent(event("admin.role_revoked", { ...identity, role: "admin" })).toJSON();
    expect(revoked.color).toBe(DANGER_RED);
    expect(revoked.description).toBe("**logtester** is no longer **admin**.");
  });

  test("feedback quotes the description and shows contact as plain text", () => {
    const embed = formatPlatformEvent(
      event("feedback.submitted", {
        ...identity,
        feedback_id: "f1",
        title: "Overlay flickers",
        category: "bug",
        priority: "high",
        description: "Line one\nLine two",
        contact: "<@999> someone",
      }),
    ).toJSON();
    expect(embed.description).toBe("**logtester** sent feedback: **Overlay flickers**\n> Line one\n> Line two");
    expect(fieldValue(embed, "Category")).toBe("Bug");
    expect(fieldValue(embed, "Priority")).toBe("High");
    expect(fieldValue(embed, "Contact")).toBe("<@999> someone");
    expect(fieldValue(embed, "Feedback ID")).toBe("`f1`");
  });

  test("clip sync: started, completed with count and duration, failed red with the error", () => {
    const started = formatPlatformEvent(
      event("clips.sync_started", { ...identity, sync_id: "s1", last_sync: null }),
    ).toJSON();
    expect(started.title).toBe("🎬 Clip sync started");
    expect(started.description).toBe("Syncing **logtester**'s Twitch clips.");
    expect(fieldValue(started, "Previous sync")).toBe("First sync");

    const completed = formatPlatformEvent(
      event("clips.sync_completed", { ...identity, sync_id: "s1", clip_count: 1234, duration_seconds: 133 }),
    ).toJSON();
    expect(completed.description).toBe("Synced 1,234 clips for **logtester**.");
    expect(fieldValue(completed, "Took")).toBe("2m 13s");

    const one = formatPlatformEvent(
      event("clips.sync_completed", { ...identity, sync_id: "s1", clip_count: 1 }),
    ).toJSON();
    expect(one.description).toBe("Synced 1 clip for **logtester**.");

    const failed = formatPlatformEvent(
      event("clips.sync_failed", {
        ...identity,
        sync_id: "s1",
        error: "Request failed with status code 429",
        duration_seconds: 4000,
      }),
    ).toJSON();
    expect(failed.color).toBe(DANGER_RED);
    expect(failed.description).toBe("Clip sync for **logtester** failed.");
    expect(fieldValue(failed, "Error")).toBe("> Request failed with status code 429");
    expect(fieldValue(failed, "Failed after")).toBe("1h 6m");
  });

  test("token refresh failed is red and names the user", () => {
    const embed = formatPlatformEvent(
      event("twitch.token_refresh_failed", { ...identity, error: "invalid_grant", status: 400 }),
    ).toJSON();
    expect(embed.color).toBe(DANGER_RED);
    expect(embed.description).toContain("Couldn't refresh **logtester**'s Twitch token.");
    expect(fieldValue(embed, "Error")).toBe("> invalid_grant");
    expect(fieldValue(embed, "Status")).toBe("400");
  });

  test("stream online failed explains a vanished stream", () => {
    const embed = formatPlatformEvent(
      event("stream.online_failed", { ...identity, reason: "stream_not_found", stream_id: "42", waited_seconds: 110 }),
    ).toJSON();
    expect(embed.color).toBe(DANGER_RED);
    expect(embed.description).toContain("still didn't list it");
    expect(fieldValue(embed, "Reason")).toBe("`stream_not_found`");
    expect(fieldValue(embed, "Stream ID")).toBe("`42`");
    expect(fieldValue(embed, "Waited")).toBe("110s");
  });

  test("stream online failed explains a stream that ended while we waited", () => {
    const embed = formatPlatformEvent(
      event("stream.online_failed", { ...identity, reason: "ended_before_tracked", stream_id: "42", waited_seconds: 20 }),
    ).toJSON();
    expect(embed.description).toContain("ended before Twitch listed it");
    expect(fieldValue(embed, "Reason")).toBe("`ended_before_tracked`");
    expect(fieldValue(embed, "Waited")).toBe("20s");
  });

  test("stream online failed leaves Waited out for older rows", () => {
    const embed = formatPlatformEvent(
      event("stream.online_failed", { ...identity, reason: "stream_not_found", stream_id: "42" }),
    ).toJSON();
    expect(fieldValue(embed, "Waited")).toBeUndefined();
  });

  test("unknown event types fall back to the raw payload", () => {
    const embed = formatPlatformEvent(event("future.thing", { a: 1 })).toJSON();
    expect(embed.title).toBe("📌 future.thing");
    expect(embed.description).toContain('"a": 1');
  });
});

describe("server log formatters", () => {
  const member = {
    id: "123456789012345678",
    username: "alt",
    display_name: "Alt",
    avatar_url: "https://cdn.discordapp.com/avatars/1/a.png",
  };
  const channel = { id: "223456789012345678", name: "general", type: "text" };

  test("member joined: blurple, Discord avatar, mention", () => {
    const embed = formatPlatformEvent(
      event("member.joined", { guild_id: "1", member, member_count: 1234, twitch_username: "logtester" }),
    ).toJSON();
    expect(embed.color).toBe(0x5865f2);
    expect(embed.title).toBe("📥 Member joined");
    expect(embed.author?.name).toBe("Alt (@alt)");
    expect(embed.thumbnail?.url).toBe(member.avatar_url);
    expect(embed.description).toBe("<@123456789012345678> joined the server. Member 1,234.");
    expect(fieldValue(embed, "StreamWizard")).toBe("[logtester](https://twitch.tv/logtester)");
  });

  test("message edited quotes before and after, with a jump link", () => {
    const embed = formatPlatformEvent(
      event("message.edited", {
        guild_id: "1",
        member,
        channel,
        message_id: "9",
        url: "https://discord.com/channels/1/2/9",
        before: "helo",
        after: "hello\nthere",
      }),
    ).toJSON();
    expect(embed.description).toContain(
      "in <#223456789012345678>. [Jump to message](https://discord.com/channels/1/2/9)",
    );
    expect(fieldValue(embed, "Before")).toBe("> helo");
    expect(fieldValue(embed, "After")).toBe("> hello\n> there");
  });

  test("message deleted without cache says so, and shows a moderator when there is one", () => {
    const uncached = formatPlatformEvent(
      event("message.deleted", { guild_id: "1", channel, message_id: "9", content: null }),
    ).toJSON();
    expect(uncached.color).toBe(DANGER_RED);
    expect(uncached.description).toBe("A message was deleted in <#223456789012345678>.");
    expect(fieldValue(uncached, "Text")).toContain("Not available");

    const byMod = formatPlatformEvent(
      event("message.deleted", {
        guild_id: "1",
        member,
        channel,
        message_id: "9",
        content: "spam",
        moderator: { id: "323456789012345678", username: "mod" },
      }),
    ).toJSON();
    expect(fieldValue(byMod, "Deleted by")).toBe("<@323456789012345678>");
    expect(fieldValue(byMod, "Text")).toBe("> spam");
  });

  test("roles changed lists role mentions", () => {
    const embed = formatPlatformEvent(
      event("member.roles_changed", {
        guild_id: "1",
        member,
        added: [{ id: "423456789012345678", name: "Verified" }],
        removed: [],
      }),
    ).toJSON();
    expect(fieldValue(embed, "Added")).toBe("<@&423456789012345678>");
    expect(fieldValue(embed, "Removed")).toBeUndefined();
    expect(fieldValue(embed, "Changed by")).toBe("Unknown");
  });

  test("deleted channels and roles use their name, not a dead mention", () => {
    const deletedChannel = formatPlatformEvent(event("channel.deleted", { guild_id: "1", channel })).toJSON();
    expect(deletedChannel.description).toBe("**#general** was deleted.");
    const deletedRole = formatPlatformEvent(
      event("role.deleted", { guild_id: "1", role: { id: "5", name: "Mods" } }),
    ).toJSON();
    expect(deletedRole.description).toBe("The **Mods** role was deleted.");
  });

  test("tickets: opener as author, dashboard link, source and claimer", () => {
    const ticket = {
      guild_id: "1",
      ticket_id: "t1",
      ticket_number: 12,
      subject: "OBS won't [connect]",
      category: "bug",
      product: "cloud_obs",
      opener: member,
      channel,
      twitch_username: "logtester",
    };

    const opened = formatPlatformEvent(event("ticket.opened", { ...ticket, source: "discord" as const })).toJSON();
    expect(opened.title).toBe("🎫 Ticket opened");
    expect(opened.author?.name).toBe("Alt (@alt)");
    expect(opened.description).toBe("<@123456789012345678> opened ticket #0012 (<#223456789012345678>).");
    expect(fieldValue(opened, "Subject")).toBe("OBS won't [connect]");
    expect(fieldValue(opened, "Product")).toBe("Cloud obs");
    expect(fieldValue(opened, "StreamWizard")).toBe("[logtester](https://twitch.tv/logtester)");

    const staff = { id: "323456789012345678", username: "mod", display_name: "Mod" };
    const claimed = formatPlatformEvent(
      event("ticket.claimed", {
        ...ticket,
        source: "dashboard" as const,
        actor: staff,
        dashboard_url: "https://admin.example/discord/tickets/12",
      }),
    ).toJSON();
    expect(claimed.description).toBe(
      "<@323456789012345678> claimed [ticket #0012](https://admin.example/discord/tickets/12) from the dashboard.",
    );

    const closed = formatPlatformEvent(
      event("ticket.closed", {
        ...ticket,
        source: "discord" as const,
        actor: staff,
        claimer: null,
        duration_seconds: 5400,
        message_count: 17,
      }),
    ).toJSON();
    expect(closed.description).toBe("<@323456789012345678> closed ticket #0012 (<#223456789012345678>).");
    expect(fieldValue(closed, "Claimed by")).toBe("Unclaimed");
    expect(fieldValue(closed, "Open for")).toBe("1h 30m");
    expect(fieldValue(closed, "Messages")).toBe("17");
    expect(fieldValue(closed, "Reason")).toBeUndefined();

    // Nobody clicked Close: the sentence names the cause instead of a person.
    const orphaned = formatPlatformEvent(
      event("ticket.closed", {
        ...ticket,
        source: "discord" as const,
        actor: null,
        close_code: "channel_deleted",
        dashboard_url: "https://admin.example/discord/tickets/12",
      }),
    ).toJSON();
    expect(orphaned.description).toBe(
      "[Ticket #0012](https://admin.example/discord/tickets/12) was closed because its channel was deleted.",
    );

    const withReason = formatPlatformEvent(
      event("ticket.closed", { ...ticket, source: "discord" as const, actor: staff, close_reason: "Fixed in v2" }),
    ).toJSON();
    expect(fieldValue(withReason, "Reason")).toBe("Fixed in v2");

    const replied = formatPlatformEvent(
      event("ticket.replied", { ...ticket, source: "dashboard" as const, author_name: "Jochem" }),
    ).toJSON();
    expect(replied.description).toBe("**Jochem** replied to ticket #0012 (<#223456789012345678>) from the dashboard.");
  });

  test("tickets: close request steps read as sentences", () => {
    const ticket = {
      guild_id: "1",
      ticket_id: "t1",
      ticket_number: 12,
      subject: "Help",
      category: "bug",
      opener: member,
      channel,
      source: "discord" as const,
    };
    const staff = { id: "323456789012345678", username: "mod", display_name: "Mod" };
    const asked = formatPlatformEvent(event("ticket.updated", { ...ticket, actor: member, change: "close_requested" })).toJSON();
    expect(asked.description).toBe("<@123456789012345678> asked to close ticket #0012 (<#223456789012345678>).");
    const rejected = formatPlatformEvent(
      event("ticket.updated", { ...ticket, actor: staff, change: "close_request_rejected", target: member, source: "dashboard" as const }),
    ).toJSON();
    expect(rejected.description).toBe(
      "<@323456789012345678> kept ticket #0012 (<#223456789012345678>) open after <@123456789012345678> asked to close it from the dashboard.",
    );
    const expired = formatPlatformEvent(event("ticket.updated", { ...ticket, actor: null, change: "close_request_expired", source: "system" as const })).toJSON();
    expect(expired.description).toBe("Nobody answered the request to close ticket #0012 (<#223456789012345678>) in time; it stays open.");
  });

  test("tickets: a rating shows stars and the comment as a quote", () => {
    const ticket = { guild_id: "1", ticket_id: "t1", ticket_number: 12, subject: "Help", category: "bug", opener: member, channel, source: "discord" as const };
    const rated = formatPlatformEvent(event("ticket.feedback", { ...ticket, rating: 4, comment: "Quick and friendly" })).toJSON();
    expect(rated.title).toBe("⭐ Ticket rated by the opener");
    expect(rated.description).toBe("<@123456789012345678> rated ticket #0012 (<#223456789012345678>) ★★★★☆ (4/5).");
    expect(fieldValue(rated, "Comment")).toBe("> Quick and friendly");
    const bare = formatPlatformEvent(event("ticket.feedback", { ...ticket, rating: 5 })).toJSON();
    expect(fieldValue(bare, "Comment")).toBeUndefined();
  });

  test("bulk delete shows cached lines in a code block without breaking it", () => {
    const embed = formatPlatformEvent(
      event("message.bulk_deleted", { guild_id: "1", channel, count: 3, lines: ["a: hi", "b: ```oops```"] }),
    ).toJSON();
    expect(embed.description).toContain("3 messages were deleted in <#223456789012345678>.");
    expect(embed.description?.match(/```/g)?.length).toBe(2);
  });
});
