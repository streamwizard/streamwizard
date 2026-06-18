import { Events } from "discord.js";
import { buildWelcomeMessage, getGuildWelcomeSettings, getJoinNumber, resolveWelcomeChannel } from "../lib/welcome";
import type { BotEvent } from "../types/discord";
import { Sentry } from "../sentry";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const settings = await getGuildWelcomeSettings(member.guild);
    if (settings?.welcome_enabled === false) return;

    const channel = await resolveWelcomeChannel(member.guild, settings?.welcome_channel_id);
    if (!channel) {
      console.warn(`[guildMemberAdd] Guild "${member.guild.name}" has no usable welcome channel configured, skipping welcome message`);
      return;
    }

    try {
      const joinNumber = await getJoinNumber(member);
      await channel.send(buildWelcomeMessage(member, joinNumber));
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[guildMemberAdd] Failed to send welcome message in "${member.guild.name}":`, error);
    }
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>;
