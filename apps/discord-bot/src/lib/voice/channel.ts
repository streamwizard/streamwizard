import {
  ChannelType,
  DiscordAPIError,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  type CategoryChannel,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type Message,
  type VoiceBasedChannel,
  type VoiceChannel,
} from "discord.js";
import { reportError } from "@repo/sentry";
import { isContextMenuCommand } from "../../types/discord";
import { buildVoiceHelpEmbed, buildVoicePanelButtons, buildVoiceSettingsEmbed, VOICE_HELP_TITLE, type HelpCommand } from "./help";
import { forgetChannelInvites } from "./invites";
import { BOT_EXTRA_PERMISSIONS, buildTempOverwrites, currentGuestIds, type RawOverwrite } from "./overwrites";
import { forgetRenameHistory } from "./rename";
import type { TempChannel } from "./rules";
import { forgetTempChannels, getHubs, getStaffRoleIds, getTempChannel, isRenameBlocked } from "./store";

// The Discord side of a temp channel: reading it, rewriting its permissions,
// deleting it. Decisions live in rules.ts and overwrites.ts.

/** People in a voice channel. Bots don't keep a channel alive. */
export function humanCount(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

export function asTempVoiceChannel(channel: GuildBasedChannel | null | undefined): VoiceChannel | null {
  return channel?.type === ChannelType.GuildVoice ? channel : null;
}

export function rawOverwrites(channel: VoiceChannel | CategoryChannel): RawOverwrite[] {
  return channel.permissionOverwrites.cache.map((o) => ({
    id: o.id,
    type: o.type,
    allow: o.allow.bitfield,
    deny: o.deny.bitfield,
  }));
}

/**
 * Rewrites the channel's permissions for `temp`'s state. Guests (people let
 * in past a lock or hide) are read off the channel as it stands, plus `add`,
 * minus `drop`.
 */
export async function applyTempPermissions(
  channel: VoiceChannel,
  temp: TempChannel,
  { add = [], drop = [], reason }: { add?: string[]; drop?: string[]; reason?: string } = {},
): Promise<void> {
  const botId = channel.client.user.id;
  const existing = currentGuestIds(rawOverwrites(channel), { ownerId: temp.ownerId, botId, bannedUserIds: temp.bannedUserIds });
  const guestIds = [...new Set([...existing, ...add])].filter(
    (id) => !drop.includes(id) && id !== temp.ownerId && id !== botId && !temp.bannedUserIds.includes(id),
  );
  await channel.permissionOverwrites.set(
    buildTempOverwrites({
      parent: channel.parent ? rawOverwrites(channel.parent) : [],
      everyoneId: channel.guild.id,
      botId,
      ownerId: temp.ownerId,
      locked: temp.locked,
      hidden: temp.hidden,
      bannedUserIds: temp.bannedUserIds,
      guestIds,
      botExtraPermissions: botExtraPermissions(channel.guild),
      staffRoleIds: await getStaffRoleIds(channel.guild.id, temp.hubId),
    }),
    reason,
  );
}

/** The BOT_EXTRA_PERMISSIONS the bot has server-wide: all of them with Administrator. */
export function botExtraPermissions(guild: Guild): bigint {
  const permissions = guild.members.me?.permissions;
  if (!permissions) return 0n;
  return permissions.has(PermissionFlagsBits.Administrator) ? BOT_EXTRA_PERMISSIONS : permissions.bitfield & BOT_EXTRA_PERMISSIONS;
}

const COMMAND_IDS_TTL_MS = 60 * 60 * 1000;
const commandIdsCache = new Map<string, { ids: Map<string, string>; at: number }>();

/**
 * Slash command name → id, for clickable mentions. Global commands plus the
 * guild's own (dev deploys there), cached an hour since they only change on a
 * deploy. Empty when Discord can't be asked, so the list falls back to text.
 */
async function commandIds(guild: Guild): Promise<Map<string, string>> {
  const cached = commandIdsCache.get(guild.id);
  if (cached && Date.now() - cached.at < COMMAND_IDS_TTL_MS) return cached.ids;

  const results = await Promise.allSettled([guild.client.application.commands.fetch(), guild.commands.fetch()]);
  const ids = new Map<string, string>();
  for (const result of results) {
    if (result.status === "fulfilled") for (const command of result.value.values()) ids.set(command.name, command.id);
  }
  if (results.some((result) => result.status === "fulfilled")) commandIdsCache.set(guild.id, { ids, at: Date.now() });
  return ids;
}

/**
 * The pinned message per channel: its id (null when the bot looked and there
 * isn't one) and the settings it shows, so an unchanged state isn't edited.
 */
const panels = new Map<string, { messageId: string | null; settings: string }>();

async function settingsEmbed(channel: VoiceChannel, temp: TempChannel) {
  const hub = temp.hubId ? (await getHubs(temp.guildId)).find((h) => h.id === temp.hubId) : null;
  return buildVoiceSettingsEmbed({
    ownerId: temp.ownerId,
    locked: temp.locked,
    hidden: temp.hidden,
    userLimit: channel.userLimit,
    bannedUserIds: temp.bannedUserIds,
    remembers: hub ? hub.remember_owner_settings : null,
    renameBlocked: await isRenameBlocked(temp.guildId, temp.ownerId),
  }).toJSON();
}

/**
 * Posts the /voice-* command list and the channel's current settings in its
 * chat, and pins it. Never throws: a channel without its list still works, so
 * failures are only reported.
 */
export async function postVoiceHelp(channel: VoiceChannel, temp: TempChannel): Promise<void> {
  try {
    const commands = new Map<string, HelpCommand>();
    for (const command of channel.client.commands.values()) {
      if (!isContextMenuCommand(command)) commands.set(command.data.name, command.data.toJSON());
    }
    const settings = await settingsEmbed(channel, temp);
    const message = await channel.send({
      embeds: [buildVoiceHelpEmbed(commands, await commandIds(channel.guild)), settings],
      components: [buildVoicePanelButtons()],
      allowedMentions: { parse: [] },
    });
    panels.set(channel.id, { messageId: message.id, settings: JSON.stringify(settings) });
    await message.pin("Voice channel commands");
  } catch (error) {
    reportError(error, "discord-bot voice: post command list", { guildId: channel.guild.id, channelId: channel.id });
  }
}

/** The bot's pinned command list in the channel. After a restart it's found among the pins, once. */
async function findPanel(channel: VoiceChannel): Promise<Message<true> | null> {
  const known = panels.get(channel.id);
  if (known?.messageId) {
    const message = await channel.messages.fetch(known.messageId).catch(() => null);
    if (message) return message;
  }
  if (known) return null;

  const pins = await channel.messages.fetchPins();
  const found = pins.items
    .map((pin) => pin.message)
    .find((message) => message.author.id === channel.client.user.id && message.embeds[0]?.title === VOICE_HELP_TITLE);
  panels.set(channel.id, { messageId: found?.id ?? null, settings: "" });
  return found ?? null;
}

/**
 * Brings the settings under the pinned command list up to date. Does nothing
 * when they haven't changed or the list was never posted. Never throws.
 */
export async function refreshVoicePanel(channel: VoiceChannel): Promise<void> {
  const temp = getTempChannel(channel.id);
  if (!temp) return;
  try {
    const settings = await settingsEmbed(channel, temp);
    const rendered = JSON.stringify(settings);
    if (panels.get(channel.id)?.settings === rendered) return;

    const message = await findPanel(channel);
    const help = message?.embeds[0];
    if (!message || !help) return;
    // The buttons go along every time, so a list pinned before they existed gets them too.
    await message.edit({ embeds: [help, settings], components: [buildVoicePanelButtons()], allowedMentions: { parse: [] } });
    panels.set(channel.id, { messageId: message.id, settings: rendered });
  } catch (error) {
    reportError(error, "discord-bot voice: update settings message", { guildId: channel.guild.id, channelId: channel.id });
  }
}

/** Everyone in the channel except the owner and bots: who a lock or hide lets back in. */
export function presentGuestIds(channel: VoiceChannel, ownerId: string): string[] {
  return channel.members.filter((m) => !m.user.bot && m.id !== ownerId).map((m) => m.id);
}

export function isInChannel(member: GuildMember | null | undefined, channelId: string): boolean {
  return member?.voice.channelId === channelId;
}

const deleting = new Set<string>();

/**
 * Deletes the channel in Discord (when it still exists) and forgets it. Safe
 * to call twice: a second call while the first runs does nothing, and a
 * channel Discord already lost counts as deleted.
 */
export async function deleteTempChannel(guild: Guild, channelId: string, reason: string): Promise<void> {
  if (deleting.has(channelId)) return;
  deleting.add(channelId);
  try {
    const channel = guild.channels.cache.get(channelId);
    if (channel) {
      await channel.delete(reason).catch((error: unknown) => {
        if (!(error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel)) throw error;
      });
    }
    await forgetTempChannels([channelId]);
    forgetRenameHistory(channelId);
    forgetChannelInvites(channelId);
    panels.delete(channelId);
  } finally {
    deleting.delete(channelId);
  }
}
