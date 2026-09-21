import { ChannelType, type Guild, type GuildBasedChannel, type NewsChannel, type TextChannel } from "discord.js";

// Checks the internal API runs before posting somewhere on an admin's behalf.
// Shared by everything web-admin publishes: built messages, announcements.

export type MessageChannel = TextChannel | NewsChannel;

/** A channel the bot can post a message in: text or announcement. */
export const isMessageChannel = (channel: GuildBasedChannel | null | undefined): channel is MessageChannel =>
  channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement;

/** Names of the given permissions the bot lacks in `channel`, in the words Discord's settings use. */
export function missingPermissions(guild: Guild, channel: MessageChannel, required: readonly (readonly [bigint, string])[]): string[] {
  const permissions = guild.members.me ? channel.permissionsFor(guild.members.me) : null;
  return required.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);
}
