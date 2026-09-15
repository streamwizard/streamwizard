import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { markSelfAction } from "./server-log/self-actions";
import type { Guild, GuildMember, Message, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import {
  getDiscordIntegrationByDiscordUserId,
  getGuildSettings,
  getPublicTwitchIntegrationByDiscordUserId,
  recordGuildMemberJoin,
} from "@repo/supabase/queries/discord";
import type { PublicTwitchIntegration } from "@repo/supabase/queries/discord";
import { Sentry } from "../sentry";
import { buildLinkRow } from "./account";

const BROADCASTER_TYPE_LABEL: Record<string, string> = {
  partner: "Twitch Partner",
  affiliate: "Twitch Affiliate",
};

export type ConnectionInfo = {
  isConnected: boolean;
  twitch: PublicTwitchIntegration | null;
  // StreamWizard account id for linked members, for analytics attribution.
  userId: string | null;
};

export async function getJoinNumber(member: GuildMember): Promise<number | null> {
  try {
    return await recordGuildMemberJoin(supabase, member.guild.id, member.id, member.guild.memberCount);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to record join number for "${member.user.tag}" in "${member.guild.name}":`, error);
    return null;
  }
}

export async function getConnectionInfo(member: GuildMember): Promise<ConnectionInfo> {
  try {
    const { data, error } = await getDiscordIntegrationByDiscordUserId(supabase, member.id);
    if (error) throw error;
    if (!data) return { isConnected: false, twitch: null, userId: null };

    const twitch = await getPublicTwitchIntegrationByDiscordUserId(supabase, member.id);
    return { isConnected: true, twitch, userId: data.user_id };
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to check connection status for "${member.user.tag}":`, error);
    return { isConnected: false, twitch: null, userId: null };
  }
}

// Part of every welcome title. purgeWelcomeMessages matches on it to tell
// welcome posts apart from the bot's other messages, so keep them in sync.
const WELCOME_TITLE_MARKER = " just got better, ";

export function buildWelcomeMessage(member: GuildMember, joinNumber: number | null, connection: ConnectionInfo) {
  const { isConnected, twitch } = connection;

  const embed = new EmbedBuilder()
    .setTitle(`${member.guild.name}${WELCOME_TITLE_MARKER}${member.user.username}`)
    .setColor(0x5865f2)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  if (isConnected && twitch) {
    embed
      .setDescription(
        `Hey ${member}, welcome in! Your StreamWizard account is linked to **${twitch.twitch_username}** on Twitch, so your roles are good to go.`,
      )
      .setFooter({ text: "Glad you're here.", iconURL: member.user.displayAvatarURL() });

    const broadcasterLabel = twitch.broadcaster_type ? BROADCASTER_TYPE_LABEL[twitch.broadcaster_type] : undefined;
    embed.addFields({
      name: "Twitch",
      value: `[twitch.tv/${twitch.twitch_username}](https://twitch.tv/${twitch.twitch_username})${broadcasterLabel ? ` · ${broadcasterLabel}` : ""}`,
      inline: true,
    });
  } else if (isConnected) {
    embed
      .setDescription(
        `Hey ${member}, welcome in. Your StreamWizard account is connected, so your roles are good to go.`,
      )
      .setFooter({ text: "Glad you're here.", iconURL: member.user.displayAvatarURL() });
  } else {
    embed
      .setDescription(`Hey ${member}, welcome in. Connect your StreamWizard account and we'll get your roles set up.`)
      .setFooter({ text: "Not connected yet? We'll fix that.", iconURL: member.user.displayAvatarURL() });
  }

  if (joinNumber !== null) {
    embed.addFields({ name: "You're member", value: `#${joinNumber}`, inline: true });
  }

  if (isConnected) {
    return { embeds: [embed] };
  }

  return { embeds: [embed], components: [buildLinkRow("Connect your account")] };
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

export type TestWelcomeResult =
  | { ok: true; channelId: string; welcomeEnabled: boolean }
  | { ok: false; reason: "no_channel" };

/**
 * Posts a mock welcome for `member` in the configured channel. Shared by
 * /test-welcome and the web-admin action. A real join's number is the live
 * member count (record_guild_member_join), so it's read directly — a preview
 * must not overwrite the member's stored join_number.
 */
export async function sendTestWelcome(member: GuildMember): Promise<TestWelcomeResult> {
  const settings = await getGuildWelcomeSettings(member.guild);
  const channel = await resolveWelcomeChannel(member.guild, settings?.welcome_channel_id);
  if (!channel) return { ok: false, reason: "no_channel" };

  const connection = await getConnectionInfo(member);
  await channel.send(buildWelcomeMessage(member, member.guild.memberCount, connection));
  return { ok: true, channelId: channel.id, welcomeEnabled: settings?.welcome_enabled !== false };
}

function isWelcomeMessage(message: Message, botId: string): boolean {
  return message.author.id === botId && message.embeds.some((embed) => embed.title?.includes(WELCOME_TITLE_MARKER));
}

const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Deletes every welcome message (real and test) the bot posted in `channel`,
 * walking the whole history. Used when the welcome channel moves so the old
 * one doesn't keep stale welcomes. Messages under 14 days old go through bulk
 * delete when the bot has Manage Messages; the rest are deleted one by one
 * (discord.js queues those around rate limits). Returns how many were deleted.
 */
export async function purgeWelcomeMessages(channel: TextChannel): Promise<number> {
  const botId = channel.client.user.id;
  const canBulkDelete = channel.permissionsFor(botId)?.has(PermissionFlagsBits.ManageMessages) ?? false;
  let before: string | undefined;
  let deleted = 0;

  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    before = batch.last()?.id;

    const welcomes = [...batch.filter((message) => isWelcomeMessage(message, botId)).values()];
    const cutoff = Date.now() - BULK_DELETE_MAX_AGE_MS + 60_000;
    const bulk = canBulkDelete ? welcomes.filter((message) => message.createdTimestamp > cutoff) : [];
    const single = welcomes.filter((message) => !bulk.includes(message));

    if (bulk.length > 1) {
      deleted += (await channel.bulkDelete(bulk, true)).size;
    } else {
      single.push(...bulk);
    }
    for (const message of single) {
      await message
        .delete()
        .then(() => deleted++)
        .catch(() => {});
    }
  }

  return deleted;
}

/**
 * Gives a new member the configured join role. Bots are skipped, and members
 * still in Membership Screening wait until they pass (guildMemberUpdate).
 */
export async function grantJoinRole(member: GuildMember, joinRoleId: string | null | undefined): Promise<void> {
  if (!joinRoleId || member.user.bot || member.pending) return;
  if (member.roles.cache.has(joinRoleId)) return;
  try {
    markSelfAction("roles", member.id);
    await member.roles.add(joinRoleId, "Join role");
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[welcome] Failed to give join role to "${member.user.tag}" in "${member.guild.name}":`, error);
  }
}

/**
 * After the welcome channel changes, purges welcome messages from the channel
 * welcomes used to go to (`previousChannelId` null = the system channel).
 * Runs in the background; returns false when there's nothing to clean up
 * because the old and new channel resolve to the same one.
 */
export async function cleanUpOldWelcomeChannel(guild: Guild, previousChannelId: string | null): Promise<boolean> {
  const [previous, settings] = await Promise.all([
    resolveWelcomeChannel(guild, previousChannelId),
    getGuildWelcomeSettings(guild),
  ]);
  const current = await resolveWelcomeChannel(guild, settings?.welcome_channel_id);
  if (!previous || previous.id === current?.id) return false;

  void purgeWelcomeMessages(previous)
    .then((count) =>
      console.log(`[welcome] Removed ${count} old welcome message(s) from #${previous.name} in "${guild.name}"`),
    )
    .catch((error) => {
      Sentry.captureException(error);
      console.error(`[welcome] Failed to clean up old welcome messages in "${guild.name}":`, error);
    });
  return true;
}
