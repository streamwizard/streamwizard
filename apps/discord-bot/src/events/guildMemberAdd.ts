import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events } from "discord.js";
import { supabase } from "@repo/supabase";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import type { BotEvent } from "../types/discord";
import { Sentry } from "../sentry";

// TODO: replace with the real StreamWizard account-linking URL once the backend flow exists.
const LINK_URL = "https://streamwizard.gg/link/discord";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    let settings;
    try {
      settings = await getGuildSettings(supabase, member.guild.id);
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[guildMemberAdd] Failed to load settings for "${member.guild.name}":`, error);
    }

    if (settings?.welcome_enabled === false) return;

    const channelId = settings?.welcome_channel_id;
    const channel = channelId ? await member.guild.channels.fetch(channelId).catch(() => null) : member.guild.systemChannel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      console.warn(`[guildMemberAdd] Guild "${member.guild.name}" has no usable welcome channel configured, skipping welcome message`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Welcome to the server!")
      .setDescription(`Hey ${member}, welcome to **${member.guild.name}**! Connect your StreamWizard account to get started.`)
      .setColor(0x5865f2)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    const button = new ButtonBuilder().setLabel("Connect your account").setStyle(ButtonStyle.Link).setURL(LINK_URL);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    try {
      await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[guildMemberAdd] Failed to send welcome message in "${member.guild.name}":`, error);
    }
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>;
