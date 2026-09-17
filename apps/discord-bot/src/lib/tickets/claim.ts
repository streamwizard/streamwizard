import { MessageFlags } from "discord.js";
import type { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import { claimTicket, getTicketByChannelId } from "@repo/supabase/queries/tickets";
import type { TicketEventSource } from "@repo/types";
import { reportError } from "@repo/sentry";
import { notifyTicketActivity } from "../ticket-activity";
import { getTicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { TICKET_IDS } from "./ids";
import { withClaimState } from "./intro";
import { isStaff } from "./staff";

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const config = await getTicketConfig(interaction.guildId);
  if (!isStaff(interaction.member, config.settings)) {
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
    const current = await getTicketByChannelId(supabase, interaction.channelId);
    const message = current?.claimed_by_discord_user_id
      ? `This ticket is already claimed by <@${current.claimed_by_discord_user_id}>.`
      : "This channel isn't a tracked ticket.";
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }

  await recordTicketEvent(interaction.guild, claimed, "claimed", interaction.member, "discord");
  void notifyTicketActivity(interaction.guildId, claimed.channel_id, "claimed", claimed.ticket_number);

  // Edit the intro message in place so the claim state + disabled button update for everyone.
  await interaction.update(withClaimState(interaction.message, claimed));
  await interaction.followUp({ content: `🙋 You claimed this ticket.`, flags: MessageFlags.Ephemeral });
}

export type ClaimTicketResult =
  | { status: "claimed" }
  | { status: "already_claimed"; claimedBy: string }
  | { status: "not_a_ticket" };

/**
 * Claims a ticket as `member` without a button interaction (web-admin
 * dashboard). Same DB write and timeline event as the Claim button, and the
 * intro message is edited so the channel shows who claimed it.
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

  await recordTicketEvent(channel.guild, claimed, "claimed", member, source);
  void notifyTicketActivity(channel.guild.id, channel.id, "claimed", claimed.ticket_number);

  // The intro is the bot's oldest message carrying the Claim button.
  const firstMessages = await channel.messages.fetch({ after: "0", limit: 10 }).catch(() => null);
  const intro = firstMessages?.find(
    (message) =>
      message.author.id === channel.client.user.id &&
      message.components.some(
        (row) => "components" in row && row.components.some((c) => "customId" in c && c.customId === TICKET_IDS.claim),
      ),
  );
  if (intro) {
    await intro
      .edit(withClaimState(intro, claimed))
      .catch((error) => reportError(error, "discord-bot tickets: update intro", { ticketId: claimed.id }));
  }
  await channel.send({ content: `🙋 ${member} claimed this ticket.`, allowedMentions: { parse: [] } }).catch(() => {});
  return { status: "claimed" };
}
