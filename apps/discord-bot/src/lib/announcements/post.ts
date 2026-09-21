import { PermissionFlagsBits, type Guild } from "discord.js";
import {
  resolveAnnouncement,
  toAnnouncementPayload,
  validateAnnouncement,
  type Announcement,
  type AnnouncementPayload,
  type MessageIssue,
  type VariableValues,
} from "@repo/discord-message";
import { isMessageChannel, missingPermissions, type MessageChannel } from "../channel-checks";

// Sends an announcement staff wrote in web-admin, or updates the one already
// in the channel. Pure apart from the channel it is handed (no env, no DB),
// so the route and the scheduler share it and tests run against a fake.

/** The slice of a discord.js channel this needs. */
export interface AnnouncementChannel {
  id: string;
  send(payload: AnnouncementPayload): Promise<{ id: string }>;
  messages: {
    edit(messageId: string, payload: AnnouncementPayload): Promise<{ id: string }>;
    delete(messageId: string): Promise<unknown>;
  };
}

/** The announcement can't be sent as designed. `issues` are written for the admin. */
export class AnnouncementError extends Error {
  constructor(readonly issues: MessageIssue[]) {
    super(issues[0]?.message ?? "The announcement can't be sent");
    this.name = "AnnouncementError";
  }
}

const UNKNOWN_MESSAGE = 10008;
const isUnknownMessage = (error: unknown) => (error as { code?: unknown } | null)?.code === UNKNOWN_MESSAGE;

export interface PostAnnouncementInput {
  channel: AnnouncementChannel;
  announcement: Announcement;
  /** Filled into [placeholders]. See guildVariableValues. */
  values: VariableValues;
  /** What an earlier post left in this channel, so it gets edited instead of posted twice. */
  previousMessageId?: string | null;
}

export interface PostAnnouncementResult {
  messageId: string;
  /** The old message was gone, so this went out as a new one, ping included. */
  resent: boolean;
}

/**
 * Posts the announcement, or edits the message an earlier post left. An edit
 * never pings again; when the old message is gone the announcement is sent
 * fresh, which does, and `resent` says so.
 */
export async function postAnnouncement(input: PostAnnouncementInput): Promise<PostAnnouncementResult> {
  // Limits are checked with the placeholders filled in: a long server name can push a title over.
  const resolved = resolveAnnouncement(input.announcement, input.values);
  const issues = validateAnnouncement(resolved);
  if (issues.length > 0) throw new AnnouncementError(issues);

  const payload = toAnnouncementPayload(resolved);
  if (input.previousMessageId) {
    try {
      const edited = await input.channel.messages.edit(input.previousMessageId, payload);
      return { messageId: edited.id, resent: false };
    } catch (error) {
      if (!isUnknownMessage(error)) throw error;
    }
    const sent = await input.channel.send(payload);
    return { messageId: sent.id, resent: true };
  }
  const sent = await input.channel.send(payload);
  return { messageId: sent.id, resent: false };
}

/** Removes the announcement's message. One a mod already deleted doesn't stand in the way. */
export async function deleteAnnouncementMessage(channel: AnnouncementChannel, messageId: string): Promise<void> {
  try {
    await channel.messages.delete(messageId);
  } catch (error) {
    if (!isUnknownMessage(error)) throw error;
  }
}

const POST_PERMISSIONS = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.EmbedLinks, "Embed Links"],
] as const;

export type ChannelCheck = { ok: true; channel: MessageChannel } | { ok: false; error: string };

/**
 * Whether the bot can post this announcement in `channelId`: the channel
 * exists and takes messages, the bot may post embeds there, and it may ping
 * whoever the announcement pings. Discord silently drops an @everyone the bot
 * isn't allowed to send, so that is refused here instead of going out quiet.
 */
export async function checkAnnouncementChannel(guild: Guild, channelId: string | null, announcement: Announcement): Promise<ChannelCheck> {
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!isMessageChannel(channel)) return { ok: false, error: "That channel is gone, or it isn't a text channel. Pick another one." };

  const missing = missingPermissions(guild, channel, POST_PERMISSIONS);
  if (missing.length > 0) return { ok: false, error: `The bot is missing ${missing.join(", ")} in #${channel.name}.` };

  const { mention } = announcement;
  const canPingEveryone = missingPermissions(guild, channel, [[PermissionFlagsBits.MentionEveryone, "Mention Everyone"]]).length === 0;
  if ((mention.kind === "everyone" || mention.kind === "here") && !canPingEveryone) {
    return { ok: false, error: `The bot can't ping @${mention.kind} without Mention Everyone in #${channel.name}.` };
  }
  if (mention.kind === "role") {
    const role = await guild.roles.fetch(mention.roleId).catch(() => null);
    if (!role) return { ok: false, error: "That role doesn't exist anymore. Pick another one, or ping nobody." };
    if (!role.mentionable && !canPingEveryone) {
      return {
        ok: false,
        error: `The bot can't ping @${role.name}. Make the role mentionable, or give the bot Mention Everyone in #${channel.name}.`,
      };
    }
  }
  return { ok: true, channel };
}

// One send or delete per announcement at a time, keyed `guildId:id`. Shared
// by the route and the scheduler, so a "Post now" and a due tick never both
// see no message id and post twice.
const busy = new Set<string>();

/** Runs `fn` unless the announcement is already being sent. `null` when it is. */
export async function withAnnouncementLock<T>(guildId: string, id: string, fn: () => Promise<T>): Promise<T | null> {
  const key = `${guildId}:${id}`;
  if (busy.has(key)) return null;
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
}
