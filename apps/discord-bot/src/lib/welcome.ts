import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } from "discord.js";
import type { Guild, GuildMember, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import { getGuildSettings, recordGuildMemberJoin } from "@repo/supabase/queries/discord";
import { Sentry } from "../sentry";
import { env } from "./env";

const LINK_URL = `${env.WEB_APP_URL}/dashboard/settings/integrations`;

export async function getJoinNumber(member: GuildMember): Promise<number | null> {
  try {
    return await recordGuildMemberJoin(supabase, member.guild.id, member.id);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to record join number for "${member.user.tag}" in "${member.guild.name}":`, error);
    return null;
  }
}

export function buildWelcomeMessage(member: GuildMember, joinNumber: number | null) {
  const embed = new EmbedBuilder()
    .setTitle(`${member.guild.name} just got better, ${member.user.username}`)
    .setDescription(`Hey ${member}, glad you're here. Connect your StreamWizard account and we'll start sorting your clips and chat.`)
    .setColor(0x5865f2)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: "No clips yet? We'll fix that.", iconURL: member.user.displayAvatarURL() })
    .setTimestamp();

  if (joinNumber !== null) {
    embed.addFields({ name: "You're member", value: `#${joinNumber}`, inline: true });
  }

  const button = new ButtonBuilder().setLabel("Connect your account").setStyle(ButtonStyle.Link).setURL(LINK_URL);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embeds: [embed], components: [row] };
}

export async function getGuildWelcomeSettings(guild: Guild) {
  try {
    return await getGuildSettings(supabase, guild.id);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to load settings for "${guild.name}":`, error);
    return null;
  }
}

export async function resolveWelcomeChannel(guild: Guild, channelId?: string | null): Promise<TextChannel | null> {
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : guild.systemChannel;

  return channel?.type === ChannelType.GuildText ? channel : null;
}
