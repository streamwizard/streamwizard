import type { Guild, Message, PartialMessage } from "discord.js";
import type { PlatformEventPayloads, PlatformEventType } from "@repo/types";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getUserIdentity } from "@repo/supabase/queries/identity";
import { TtlCache } from "@repo/ttl-cache";
import {
  emitPlatformEvent,
  isLogRouteActive,
  type EmitPlatformEventInput,
} from "@repo/supabase/queries/platform-events";
import { getLogChannelIds, getLogRoutingFor } from "../log-channel/worker";
import { isOpenTicketChannel } from "../ticket-activity";
import { isIgnoredChannel } from "./refs";

// Queues Discord server events into platform_events, the same table and
// worker as platform events. Unlike platform events, a server event that's
// turned off isn't stored at all: members, messages and voice are busy, and
// staff chose not to see them.

const LINK_TTL_MS = 5 * 60 * 1000;

interface LinkedAccount {
  userId: string;
  twitch_username: string | null;
  twitch_user_id: string | null;
}

/** Bounded: a busy server sees thousands of distinct members. Unlinked users are a cached null. */
const linkCache = new TtlCache<LinkedAccount>({ ttlMs: LINK_TTL_MS });

/** The StreamWizard account linked to a Discord user, cached for 5 minutes. */
function linkedAccount(discordUserId: string): Promise<LinkedAccount | null> {
  return linkCache.fetch(discordUserId, async () => {
    const identity = await getUserIdentity(supabase, { discordUserId });
    if (!identity) return null;
    return {
      userId: identity.userId,
      twitch_username: identity.twitch?.username ?? null,
      twitch_user_id: identity.twitch?.userId ?? null,
    };
  });
}

/**
 * Whether this event type is posted for the guild: turned on and routed to a
 * channel. Checked before doing any work (audit log lookups) and before
 * storing, so nothing piles up for a guild without a log channel.
 */
export async function isServerEventEnabled(guild: Guild, type: PlatformEventType): Promise<boolean> {
  return isLogRouteActive(await getLogRoutingFor(guild.client, guild.id), type);
}

type ServerPayload<T extends PlatformEventType> = Omit<PlatformEventPayloads[T], "guild_id">;

interface EmitOptions {
  /** Discord id of who it's about, to link a StreamWizard account. */
  subjectDiscordId?: string | null;
  /** Discord id of the moderator, to link a StreamWizard account. */
  actorDiscordId?: string | null;
  /**
   * "always": store the row even when the type is turned off (the worker
   * then marks it skipped), so the dashboard viewer keeps it. For low-volume
   * events like tickets. Default: don't store what staff turned off.
   */
  store?: "always" | "when_enabled";
}

/** Never throws: a lost log row must not break the bot's other event handlers. */
export async function emitServerEvent<T extends PlatformEventType>(
  guild: Guild,
  type: T,
  payload: ServerPayload<T>,
  options: EmitOptions = {},
): Promise<void> {
  try {
    if (options.store !== "always" && !(await isServerEventEnabled(guild, type))) return;

    const [subject, actor] = await Promise.all([
      options.subjectDiscordId ? linkedAccount(options.subjectDiscordId) : null,
      options.actorDiscordId ? linkedAccount(options.actorDiscordId) : null,
    ]);

    const event = {
      type,
      subjectUserId: subject?.userId ?? null,
      actorUserId: actor?.userId ?? null,
      payload: {
        ...payload,
        guild_id: guild.id,
        discord_user_id: options.subjectDiscordId ?? null,
        twitch_username: subject?.twitch_username ?? null,
        twitch_user_id: subject?.twitch_user_id ?? null,
      },
    } as EmitPlatformEventInput;

    const { error } = await emitPlatformEvent(supabase, event);
    if (error) throw error;
  } catch (error) {
    reportError(error, "discord-bot server-log: emit", { type, guildId: guild.id });
  }
}

/**
 * Whether a message edit or delete should be logged: guild messages from
 * people (not bots or webhooks), outside ignored channels, log channels and
 * open tickets.
 */
export async function shouldLogMessage(guild: Guild, message: Message | PartialMessage): Promise<boolean> {
  if (message.author?.bot || message.webhookId) return false;
  const channel = message.channel;
  const parentId = channel && "parentId" in channel ? channel.parentId : null;

  const routing = await getLogRoutingFor(guild.client, guild.id);
  if (!routing) return false;
  if (isIgnoredChannel(routing.ignoredChannelIds, message.channelId, parentId)) return false;
  if ((await getLogChannelIds(guild.client, guild.id)).has(message.channelId)) return false;
  if (await isOpenTicketChannel(guild.id, message.channelId).catch(() => false)) return false;
  return true;
}
