import {
  DiscordUnknownMessageError,
  editDiscordChannelMessage,
  sendDiscordChannelMessage,
  type DiscordMessagePayload,
} from "@repo/discord-api";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import {
  getLatestLivePost,
  insertLivePost,
  markLivePostEnded,
  reviveLivePost,
  updateLivePostDetails,
  type DiscordLivePost,
} from "@repo/supabase/queries/discord-live";
import { getUserIdentity } from "@repo/supabase/queries/identity";
import type { Stream } from "@repo/types";
import { liveEnv, resolveLiveTarget, type LiveTarget } from "./discord-live-target";

// Go-live posts in the StreamWizard Discord (SW-336). stream.online posts one
// embed in the guild's live channel for a broadcaster with Discord linked who
// hasn't switched it off; channel.update keeps the title and game current;
// stream.offline edits the message to say the stream ended. Nobody is ever
// pinged: the streamer is named with a silent mention. rest-api talks to
// Discord REST directly: stream.online only reaches this webhook, never the
// bot's conduit.
//
// All three entry points swallow everything. A Discord hiccup must never touch
// the rest of the stream pipeline, so the handlers call them un-awaited. The
// live role (discord-live-role.ts) shares the target resolution in
// discord-live-target.ts.

/**
 * A stream that drops and comes back inside this window edits the existing
 * message instead of posting again, so a flaky connection doesn't spam the
 * channel.
 */
export const LIVE_POST_COOLDOWN_MS = 10 * 60_000;

/** Twitch purple: the embed reports on a Twitch stream (docs/branding.md). */
const TWITCH_PURPLE = 0x9146ff;

const twitchUrl = (login: string) => `https://twitch.tv/${login}`;

/** Helix thumbnail with the size placeholders filled and a cache-buster per stream. */
function thumbnailUrl(template: string, startedAt: string): string | null {
  if (!template) return null;
  const url = template.replace("{width}", "1280").replace("{height}", "720");
  return `${url}?t=${Date.parse(startedAt) || Date.now()}`;
}

/** Same preview Helix hands out, rebuilt from the login when the stream object isn't at hand. */
function thumbnailUrlForLogin(login: string, startedAt: string): string {
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-1280x720.jpg?t=${Date.parse(startedAt) || Date.now()}`;
}

/** "2h 13m", "48m", "under a minute". */
export function formatStreamDuration(startedAt: string, endedAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000));
  if (minutes < 1) return "under a minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export interface LiveEmbedInput {
  userLogin: string;
  userName: string;
  title: string | null;
  gameName: string | null;
  startedAt: string;
  thumbnailUrl: string | null;
}

/**
 * The "live now" message. The mention renders as the streamer's name but
 * notifies nobody: allowed_mentions is empty on purpose.
 */
export function buildLiveMessage(stream: LiveEmbedInput, { discordUserId }: { discordUserId: string }): DiscordMessagePayload {
  const url = twitchUrl(stream.userLogin);
  return {
    content: `<@${discordUserId}> is live`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: stream.title || "Live now",
        url,
        color: TWITCH_PURPLE,
        author: { name: stream.userName, url },
        fields: [{ name: "Game", value: stream.gameName || "No game set" }],
        ...(stream.thumbnailUrl ? { image: { url: stream.thumbnailUrl } } : {}),
        footer: { text: "Live on Twitch" },
        timestamp: stream.startedAt,
      },
    ],
  };
}

/** The same message after the stream ended: no thumbnail, a duration. */
export function buildEndedMessage(
  stream: LiveEmbedInput,
  { discordUserId, endedAt }: { discordUserId: string; endedAt: string },
): DiscordMessagePayload {
  const url = twitchUrl(stream.userLogin);
  return {
    content: `<@${discordUserId}> was live`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: stream.title || "Stream ended",
        url,
        color: TWITCH_PURPLE,
        author: { name: stream.userName, url },
        fields: [{ name: "Game", value: stream.gameName || "No game set" }],
        footer: { text: `Ended. Streamed for ${formatStreamDuration(stream.startedAt, endedAt)}` },
        timestamp: stream.startedAt,
      },
    ],
  };
}

const fromStream = (stream: Stream): LiveEmbedInput => ({
  userLogin: stream.user_login,
  userName: stream.user_name,
  title: stream.title || null,
  gameName: stream.game_name || null,
  startedAt: stream.started_at,
  thumbnailUrl: thumbnailUrl(stream.thumbnail_url, stream.started_at),
});

const fromPost = (post: DiscordLivePost): LiveEmbedInput => ({
  userLogin: post.user_login,
  userName: post.user_name,
  title: post.title,
  gameName: post.game_name,
  startedAt: post.started_at,
  thumbnailUrl: null,
});

/**
 * Posts the go-live message for a stream that Helix confirmed, or refreshes
 * the previous one when the stream came back within the cooldown. Takes the
 * resolved target when the caller already has it (stream.online resolves
 * once for the post and the live role). Resolves to what happened, mainly
 * for tests; never throws.
 */
export async function postGoLive(
  stream: Stream,
  target?: LiveTarget | null,
): Promise<"posted" | "revived" | "skipped"> {
  try {
    const resolved = target === undefined ? await resolveLiveTarget(stream.user_id) : target;
    if (!resolved) return "skipped";

    const { settings, preferences, discordUserId, userId } = resolved;
    if (!settings.live_enabled || !settings.live_channel_id) return "skipped";

    // On by default: only an explicit false opts out.
    if (preferences?.discord_live_notifications === false) return "skipped";

    const payload = buildLiveMessage(fromStream(stream), { discordUserId });

    const latest = await getLatestLivePost(supabase, stream.user_id);
    if (latest && Date.now() - Date.parse(latest.posted_at) < LIVE_POST_COOLDOWN_MS) {
      try {
        await editDiscordChannelMessage(latest.channel_id, latest.message_id, payload);
        await reviveLivePost(supabase, latest.id, {
          stream_id: stream.id,
          started_at: stream.started_at,
          title: stream.title || null,
          game_name: stream.game_name || null,
        });
        return "revived";
      } catch (error) {
        // Someone deleted the earlier post: fall through and post a new one.
        if (!(error instanceof DiscordUnknownMessageError)) throw error;
      }
    }

    const { id } = await sendDiscordChannelMessage(settings.live_channel_id, payload);
    await insertLivePost(supabase, {
      broadcaster_id: stream.user_id,
      user_id: userId,
      stream_id: stream.id,
      channel_id: settings.live_channel_id,
      message_id: id,
      title: stream.title || null,
      game_name: stream.game_name || null,
      user_login: stream.user_login,
      user_name: stream.user_name,
      started_at: stream.started_at,
    });
    return "posted";
  } catch (error) {
    reportError(error, "eventsub.stream-online.discord-live", { broadcasterUserId: stream.user_id, streamId: stream.id });
    return "skipped";
  }
}

/**
 * Keeps the open go-live post in step with the channel's title and category
 * (channel.update). Nothing to do when there is no open post or nothing
 * changed. Never throws.
 */
export async function refreshGoLive(
  broadcasterId: string,
  update: { title: string; categoryName: string },
): Promise<"refreshed" | "skipped"> {
  try {
    if (!liveEnv()) return "skipped";

    const latest = await getLatestLivePost(supabase, broadcasterId);
    if (!latest || latest.ended_at) return "skipped";

    const title = update.title || null;
    const gameName = update.categoryName || null;
    if (title === latest.title && gameName === latest.game_name) return "skipped";

    const identity = latest.user_id ? await getUserIdentity(supabase, { userId: latest.user_id }) : null;
    const discordUserId = identity?.discord?.userId;

    try {
      const payload = buildLiveMessage(
        { ...fromPost(latest), title, gameName, thumbnailUrl: thumbnailUrlForLogin(latest.user_login, latest.started_at) },
        { discordUserId: discordUserId ?? "" },
      );
      if (!discordUserId) delete payload.content;
      await editDiscordChannelMessage(latest.channel_id, latest.message_id, payload);
    } catch (error) {
      // Deleted in Discord: leave it, stream.offline closes the row.
      if (!(error instanceof DiscordUnknownMessageError)) throw error;
    }
    await updateLivePostDetails(supabase, latest.id, { title, game_name: gameName });
    return "refreshed";
  } catch (error) {
    reportError(error, "eventsub.channel-update.discord-live", { broadcasterUserId: broadcasterId });
    return "skipped";
  }
}

/**
 * Marks the broadcaster's open go-live post as ended. A message that was
 * deleted in Discord is simply closed in the database. Never throws.
 */
export async function endGoLive(broadcasterId: string, endedAt = new Date().toISOString()): Promise<"ended" | "skipped"> {
  try {
    if (!liveEnv()) return "skipped";

    const latest = await getLatestLivePost(supabase, broadcasterId);
    if (!latest || latest.ended_at) return "skipped";

    const identity = latest.user_id ? await getUserIdentity(supabase, { userId: latest.user_id }) : null;
    const discordUserId = identity?.discord?.userId;

    try {
      // Without a Discord id to name, keep the content as it was posted.
      const payload = buildEndedMessage(fromPost(latest), { discordUserId: discordUserId ?? "", endedAt });
      if (!discordUserId) delete payload.content;
      await editDiscordChannelMessage(latest.channel_id, latest.message_id, payload);
    } catch (error) {
      if (!(error instanceof DiscordUnknownMessageError)) throw error;
    }
    await markLivePostEnded(supabase, latest.id, endedAt);
    return "ended";
  } catch (error) {
    reportError(error, "eventsub.stream-offline.discord-live", { broadcasterUserId: broadcasterId });
    return "skipped";
  }
}
