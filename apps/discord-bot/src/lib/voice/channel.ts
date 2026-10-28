import {
  ChannelType,
  DiscordAPIError,
  RESTJSONErrorCodes,
  type CategoryChannel,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type VoiceBasedChannel,
  type VoiceChannel,
} from "discord.js";
import { buildTempOverwrites, currentGuestIds, type RawOverwrite } from "./overwrites";
import { forgetRenameHistory } from "./rename";
import type { TempChannel } from "./rules";
import { forgetTempChannels } from "./store";

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
    }),
    reason,
  );
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
  } finally {
    deleting.delete(channelId);
  }
}
