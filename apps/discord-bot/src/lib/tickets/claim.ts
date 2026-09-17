import { ChannelType, MessageFlags } from "discord.js";
import type { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import { claimTicket, getTicketByChannelId, type DiscordTicket } from "@repo/supabase/queries/tickets";
import type { TicketEventSource } from "@repo/types";
import { reportError } from "@repo/sentry";
import { notifyTicketActivity } from "../ticket-activity";
import { applyTicketOverwrites, releaseTicket } from "./actions";
import { findCategory, getTicketConfig, type TicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { findIntroMessage, withTicketState } from "./intro";
import { isStaff } from "./staff";

/** Everything a claim changes besides the row: the timeline, the dashboard, and who can still see the channel. */
async function afterClaim(
  channel: TextChannel,
  claimed: DiscordTicket,
  member: GuildMember,
  config: TicketConfig,
  source: TicketEventSource,
): Promise<void> {
  await recordTicketEvent(channel.guild, claimed, "claimed", member, source);
  void notifyTicketActivity(channel.guild.id, channel.id, "claimed", claimed.ticket_number);
  if (config.settings?.claim_hides_from_other_staff) {
    // Best effort: a claim stands even when the bot can't hide the channel.
    await applyTicketOverwrites(channel, claimed, config).catch((error) =>
      reportError(error, "discord-bot tickets: hide claimed ticket", { ticketId: claimed.id }),
    );
  }
}

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild() || interaction.channel?.type !== ChannelType.GuildText) return;

  const config = await getTicketConfig(interaction.guildId);
  const current = await getTicketByChannelId(supabase, interaction.channelId);
  if (!isStaff(interaction.member, config.settings, findCategory(config, current?.category))) {
    await interaction.reply({ content: "Only staff can claim tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  const claimed = await claimTicket(
    supabase,
    interaction.channelId,
    interaction.user.id,
    interaction.member.displayName,
  );

  // Race-safe: claimTicket returns null if it was already claimed (or not a ticket).
  if (!claimed) {
    const message = current?.claimed_by_discord_user_id
      ? `This ticket is already claimed by <@${current.claimed_by_discord_user_id}>.`
      : "This channel isn't a tracked ticket.";
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }

  // Edit the intro message in place so the claim state and its button update for everyone.
  await interaction.update(withTicketState(interaction.message, claimed, config));
  await afterClaim(interaction.channel, claimed, interaction.member, config, "discord");
  await interaction.followUp({ content: `🙋 You claimed this ticket.`, flags: MessageFlags.Ephemeral });
}

export async function handleReleaseButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild() || interaction.channel?.type !== ChannelType.GuildText) return;

  const config = await getTicketConfig(interaction.guildId);
  const current = await getTicketByChannelId(supabase, interaction.channelId);
  if (!isStaff(interaction.member, config.settings, findCategory(config, current?.category))) {
    await interaction.reply({ content: "Only staff can release tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  // The release edits the intro itself, so the button press only needs acknowledging.
  await interaction.deferUpdate();
  const result = await releaseTicket(interaction.channel, interaction.member);
  if (!result.ok) await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
}

export type ClaimTicketResult =
  | { status: "claimed" }
  | { status: "already_claimed"; claimedBy: string }
  | { status: "not_a_ticket" };

/**
 * Claims a ticket as `member` without a button interaction (the `/ticket
 * claim` command, the web-admin dashboard). Same DB write and timeline event
 * as the Claim button, and the intro message is edited so the channel shows
 * who claimed it.
 */
export async function claimTicketAs(
  channel: TextChannel,
  member: GuildMember,
  source: TicketEventSource = "discord",
): Promise<ClaimTicketResult> {
  const claimed = await claimTicket(supabase, channel.id, member.id, member.displayName);
  if (!claimed) {
    const current = await getTicketByChannelId(supabase, channel.id);
    if (!current) return { status: "not_a_ticket" };
    return {
      status: "already_claimed",
      claimedBy: current.claimed_by_name ?? current.claimed_by_discord_user_id ?? "someone",
    };
  }

  const config = await getTicketConfig(channel.guild.id);
  await afterClaim(channel, claimed, member, config, source);

  const intro = await findIntroMessage(channel);
  if (intro) {
    await intro
      .edit(withTicketState(intro, claimed, config))
      .catch((error) => reportError(error, "discord-bot tickets: update intro", { ticketId: claimed.id }));
  }
  await channel.send({ content: `🙋 ${member} claimed this ticket.`, allowedMentions: { parse: [] } }).catch(() => {});
  return { status: "claimed" };
}
