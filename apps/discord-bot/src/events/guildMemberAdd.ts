import { Events } from "discord.js";
import { buildWelcomeMessage, getConnectionInfo, getGuildWelcomeSettings, getJoinNumber, resolveWelcomeChannel } from "../lib/welcome";
import type { BotEvent } from "../types/discord";
import { Sentry } from "../sentry";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    console.log(`[guildMemberAdd] Member "${member.user.tag}" joined guild "${member.guild.name}"`);
    const settings = await getGuildWelcomeSettings(member.guild);
    if (settings?.welcome_enabled === false) {
      console.warn(`[guildMemberAdd] Guild "${member.guild.name}" has welcome messages disabled, skipping welcome message`);
      return;
    }


    console.log(`[guildMemberAdd] Guild "${member.guild.name}" has welcome messages enabled, sending welcome message`);
    const channel = await resolveWelcomeChannel(member.guild, settings?.welcome_channel_id);
    if (!channel) {
      console.warn(`[guildMemberAdd] Guild "${member.guild.name}" has no usable welcome channel configured, skipping welcome message`);
      return;
    }

    console.log(`[guildMemberAdd] Sending welcome message to channel "${channel.name}"`);
    try {
      const [joinNumber, connection] = await Promise.all([getJoinNumber(member), getConnectionInfo(member)]);
      await channel.send(buildWelcomeMessage(member, joinNumber, connection));
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[guildMemberAdd] Failed to send welcome message in "${member.guild.name}":`, error);
    }
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>;
