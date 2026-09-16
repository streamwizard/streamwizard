import type { AuditLogEvent, Guild, GuildAuditLogsEntry, Message, PartialMessage } from "discord.js";
import type { PlatformEventPayloads, PlatformEventType } from "@repo/types";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getUserIdentity } from "@repo/supabase/queries/identity";
import { TtlCache } from "@repo/ttl-cache";
import {
  isLogRouteActive,
  logPlatformEvent,
  type EmitPlatformEventInput,
} from "@repo/supabase/queries/platform-events";
import { getLogChannelIds, getLogRoutingFor } from "../log-channel/worker";
import { isOpenTicketChannel } from "../ticket-activity";
import { findAuditEntry } from "./audit";
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

    await logPlatformEvent(supabase, event, "discord-bot server-log: emit", { guildId: guild.id });
  } catch (error) {
    reportError(error, "discord-bot server-log: emit", { type, guildId: guild.id });
  }
}

interface AuditLookup {
  type: AuditLogEvent;
  targetId?: string | null;
  /** For message and member-move entries, `extra.channel`. */
  channelId?: string | null;
  /** Extra check on the entry, e.g. that a MemberUpdate entry touched timeouts. */
  where?: (entry: GuildAuditLogsEntry) => boolean;
}

type AuditedPayload<T extends PlatformEventType> = Omit<ServerPayload<T>, "moderator" | "reason">;

interface AuditedOptions extends EmitOptions {
  /** Reason when the audit log has none, e.g. the ban's own reason. */
  fallbackReason?: string | null;
}

/**
 * The moderation ritual shared by most server events: check the type is on,
 * build the payload, look up who did it in the audit log, skip when that was
 * the bot itself, then emit with `moderator`, `reason` and the actor filled
 * in. `payload` may be a function so channel and ticket checks only run for
 * an enabled type; returning null skips the event. `audit` null means no
 * lookup (the event has no audit entry).
 */
export async function emitAuditedEvent<T extends PlatformEventType>(
  guild: Guild,
  type: T,
  audit: AuditLookup | null,
  payload: AuditedPayload<T> | (() => AuditedPayload<T> | null | Promise<AuditedPayload<T> | null>),
  options: AuditedOptions = {},
): Promise<void> {
  try {
    if (!(await isServerEventEnabled(guild, type))) return;
    const body = typeof payload === "function" ? await payload() : payload;
    if (!body) return;

    const match = audit ? await findAuditEntry(guild, audit.type, audit) : null;
    if (match?.bySelf) return;

    const { fallbackReason = null, ...emitOptions } = options;
    await emitServerEvent(
      guild,
      type,
      {
        ...body,
        moderator: match?.moderator ?? null,
        reason: match?.reason ?? fallbackReason,
      } as unknown as ServerPayload<T>,
      { ...emitOptions, actorDiscordId: match?.moderator?.id ?? emitOptions.actorDiscordId },
    );
  } catch (error) {
    reportError(error, "discord-bot server-log: audited emit", { type, guildId: guild.id });
  }
}

/**
 * Whether messages in this channel are logged at all: a guild with routing,
 * the channel and its category not ignored, not a log channel, not an open
 * ticket.
 */
export async function isLoggedChannel(guild: Guild, channelId: string, parentId?: string | null): Promise<boolean> {
  const routing = await getLogRoutingFor(guild.client, guild.id);
  if (!routing) return false;
  if (isIgnoredChannel(routing.ignoredChannelIds, channelId, parentId)) return false;
  if ((await getLogChannelIds(guild.client, guild.id)).has(channelId)) return false;
  if (await isOpenTicketChannel(guild.id, channelId).catch(() => false)) return false;
  return true;
}

/**
 * Whether a message edit or delete should be logged: guild messages from
 * people (not bots or webhooks), in a logged channel.
 */
export async function shouldLogMessage(guild: Guild, message: Message | PartialMessage): Promise<boolean> {
  if (message.author?.bot || message.webhookId) return false;
  const channel = message.channel;
  const parentId = channel && "parentId" in channel ? channel.parentId : null;
  return isLoggedChannel(guild, message.channelId, parentId);
}
