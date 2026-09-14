import { DiscordChannelType } from "@repo/discord-api";

export type ChannelKind = "text" | "voice" | "category";

const CHANNEL_TYPES: Record<ChannelKind, number[]> = {
  // Plain text only: the bot resolves welcome channels as GuildText, and
  // announcement channels don't make sense for tickets or logs.
  text: [DiscordChannelType.GuildText],
  voice: [DiscordChannelType.GuildVoice, DiscordChannelType.GuildStageVoice],
  category: [DiscordChannelType.GuildCategory],
};

export function channelKind(type: number): ChannelKind | null {
  for (const [kind, types] of Object.entries(CHANNEL_TYPES) as [ChannelKind, number[]][]) {
    if (types.includes(type)) return kind;
  }
  return null;
}
