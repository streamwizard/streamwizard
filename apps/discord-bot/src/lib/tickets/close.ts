import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ButtonInteraction, Guild, GuildMember, ModalSubmitInteraction, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import {
  closeTicket,
  getTicketByChannelId,
  type DiscordTicket,
  type DiscordTicketCloseCode,
} from "@repo/supabase/queries/tickets";
import { listOpenTicketsByOpener } from "@repo/supabase/queries/ticket-lifecycle";
import type { TicketEventSource } from "@repo/types";
import { reportError } from "@repo/sentry";
import { notifyTicketActivity, trackTicketChannel } from "../ticket-activity";
import { reconcileTicketTranscript } from "../ticket-transcript";
import { stampTicketTranscript } from "@repo/supabase/queries/ticket-archive";
import { sendCloseDm } from "./close-dm";
import { findCategory, getTicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { TICKET_IDS } from "./ids";
import { isStaff } from "./staff";

export type CloseTicketResult = "closed" | "not_a_ticket" | "already_closed" | "transcript_failed";

export const CLOSE_RESULT_MESSAGES: Record<Exclude<CloseTicketResult, "closed">, string> = {
  not_a_ticket: "This channel isn't a tracked ticket.",
  already_closed: "This ticket was already closed.",
  transcript_failed:
    "Couldn't finish saving this ticket's conversation, so the channel stays open. Try closing it again in a minute.",
};

interface FinalizeCloseOptions {
  code: DiscordTicketCloseCode;
  reason?: string | null;
  /** Null when no person closed it. */
  actor: GuildMember | null;
  source?: TicketEventSource;
  /** The channel to delete afterwards. Null when it is already gone. */
  channel: TextChannel | null;
  /** Messages saved to the transcript, when one was captured just before. */
  messageCount?: number;
}

/**
 * The one way a ticket ends: the race-safe DB close, the timeline + log event,
 * the cache and dashboard nudge, then the channel. Every close route goes
 * through here so a ticket can't end up closed without a closed_at or an event.
 * Returns the closed row, or null when someone else closed it first.
 */
export async function finalizeTicketClose(
  guild: Guild,
  ticket: DiscordTicket,
  { code, reason = null, actor, source = "discord", channel, messageCount }: FinalizeCloseOptions,
): Promise<DiscordTicket | null> {
  // Two closes at once: only the first update wins; the other leaves the
  // channel to the winner.
  const closed = await closeTicket(supabase, ticket.channel_id, {
    code,
    reason,
    closedByDiscordUserId: actor?.id ?? null,
    closedByName: actor?.displayName ?? null,
  });
  if (!closed) return null;

  await recordTicketEvent(
    guild,
    messageCount === undefined ? closed : { ...closed, transcript_message_count: messageCount },
    "closed",
    actor,
    source,
    { detail: { code } },
  );
  trackTicketChannel(guild.id, ticket.channel_id, null);
  void notifyTicketActivity(guild.id, ticket.channel_id, "closed", ticket.ticket_number);
  // The opener's copy. Best effort, and off the close's path.
  void sendCloseDm(guild, closed);

  if (channel) await channel.delete(actor ? `Ticket closed by ${actor.user.tag}` : `Ticket closed (${code})`);
  return closed;
}

// Shared by the close-confirm button, the /ticket close command and the
// dashboard. The channel is reconciled against the archive before anything
// else: if that fails the ticket stays open and the channel isn't deleted, so
// no conversation is ever lost.
export async function closeTicketChannel(
  channel: TextChannel,
  closedBy: GuildMember,
  source: TicketEventSource = "discord",
  reason: string | null = null,
): Promise<CloseTicketResult> {
  const ticket = await getTicketByChannelId(supabase, channel.id);
  if (!ticket) return "not_a_ticket";
  if (ticket.status !== "open") return "already_closed";

  let messageCount: number;
  try {
    messageCount = await reconcileTicketTranscript(channel, ticket);
  } catch (error) {
    reportError(error, "discord-bot tickets: transcript", { ticketId: ticket.id, ticketNumber: ticket.ticket_number });
    return "transcript_failed";
  }

  const closed = await finalizeTicketClose(channel.guild, ticket, {
    code: "manual",
    reason,
    actor: closedBy,
    source,
    channel,
    messageCount,
  });
  return closed ? "closed" : "already_closed";
}

/**
 * A ticket channel deleted by hand, outside the close flow. The row would stay
 * open forever, so it is closed here. The channel can't be read any more, so
 * the transcript is whatever the live archive caught, sealed as it stands.
 * Returns whether the channel was an open ticket.
 */
export async function closeOrphanedTicket(guild: Guild, channelId: string): Promise<boolean> {
  const ticket = await getTicketByChannelId(supabase, channelId);
  if (!ticket || ticket.status !== "open") return false;
  const messageCount = await stampTicketTranscript(supabase, ticket.id).catch((error) => {
    reportError(error, "discord-bot tickets: seal transcript", { ticketId: ticket.id });
    return undefined;
  });
  const closed = await finalizeTicketClose(guild, ticket, { code: "channel_deleted", actor: null, channel: null, messageCount });
  return closed !== null;
}

/**
 * The opener left the server. When the server is set to close on that, each of
 * their open tickets is saved and closed; a ticket whose transcript can't be
 * saved stays open for staff, like any other close.
 */
export async function closeTicketsOfDepartedMember(guild: Guild, discordUserId: string): Promise<void> {
  const config = await getTicketConfig(guild.id);
  if (!config.settings?.close_on_member_leave) return;

  for (const ticket of await listOpenTicketsByOpener(supabase, guild.id, discordUserId)) {
    const fetched = await guild.channels.fetch(ticket.channel_id).catch(() => null);
    const channel = fetched?.type === ChannelType.GuildText ? fetched : null;
    let messageCount: number | undefined;
    if (channel) {
      try {
        messageCount = await reconcileTicketTranscript(channel, ticket);
      } catch (error) {
        reportError(error, "discord-bot tickets: transcript", { ticketId: ticket.id, ticketNumber: ticket.ticket_number });
        continue;
      }
    }
    await finalizeTicketClose(guild, ticket, { code: "member_left", actor: null, channel, messageCount });
  }
}

/**
 * Whether `member` may close the ticket in this channel, with the sentence
 * for when they may not. Staff always may; the opener may when the server's
 * close mode says "either", and is pointed at Request close under "request".
 */
async function mayClose(member: GuildMember, channelId: string): Promise<{ allowed: boolean; refusal: string }> {
  const [config, ticket] = await Promise.all([getTicketConfig(member.guild.id), getTicketByChannelId(supabase, channelId)]);
  const category = findCategory(config, ticket?.category);
  if (isStaff(member, config.settings, category)) return { allowed: true, refusal: "" };
  const opener = !!ticket && member.id === ticket.opener_discord_user_id;
  const mode = config.settings?.close_mode ?? "staff_only";
  if (opener && mode === "either") return { allowed: true, refusal: "" };
  if (opener && mode === "request") return { allowed: false, refusal: "Only staff can close tickets. Hit Request close and they'll take it from there." };
  return { allowed: false, refusal: "Only staff can close tickets." };
}

export async function handleCloseButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const permission = await mayClose(interaction.member, interaction.channelId);
  if (!permission.allowed) {
    await interaction.reply({ content: permission.refusal, flags: MessageFlags.Ephemeral });
    return;
  }

  const confirm = new ButtonBuilder()
    .setCustomId(TICKET_IDS.closeConfirm)
    .setLabel("Close it")
    .setStyle(ButtonStyle.Danger);
  const withReason = new ButtonBuilder()
    .setCustomId(TICKET_IDS.closeReason)
    .setLabel("Close with a reason")
    .setStyle(ButtonStyle.Secondary);
  const cancel = new ButtonBuilder()
    .setCustomId(TICKET_IDS.closeCancel)
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, withReason, cancel);

  await interaction.reply({
    content: "Close this ticket? The channel will be deleted.",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCloseCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({ content: "Cancelled — the ticket stays open.", components: [] });
}

export const CLOSE_REASON_MAX = 1000;
const REASON_FIELD = "reason";

/** "Close with a reason": the reason goes on the ticket, the log and (later) the opener's closing DM. */
export async function handleCloseReasonButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const permission = await mayClose(interaction.member, interaction.channelId);
  if (!permission.allowed) {
    await interaction.update({ content: permission.refusal, components: [] });
    return;
  }

  const reason = new LabelBuilder()
    .setLabel("Why is this ticket closing?")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(REASON_FIELD)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Fixed in the latest update")
        .setMaxLength(CLOSE_REASON_MAX)
        .setRequired(true),
    );
  await interaction.showModal(
    new ModalBuilder().setCustomId(TICKET_IDS.closeSubmit).setTitle("Close ticket").addLabelComponents(reason),
  );
}

async function closeFromInteraction(
  interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  reason: string | null,
): Promise<void> {
  // Both arrive from the ephemeral confirm message, so both can rewrite it in place.
  const acknowledge = (content: string) =>
    interaction.isButton() || interaction.isFromMessage()
      ? interaction.update({ content, components: [] })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral });

  const permission = await mayClose(interaction.member, interaction.channelId ?? "");
  if (!permission.allowed) {
    await acknowledge(permission.refusal);
    return;
  }
  if (interaction.channel?.type !== ChannelType.GuildText) {
    await acknowledge("This isn't a ticket channel.");
    return;
  }

  // Acknowledge before the channel goes: afterwards there is nothing left to reply in.
  await acknowledge("Closing this ticket…");
  const result = await closeTicketChannel(interaction.channel, interaction.member, "discord", reason);
  if (result !== "closed") await interaction.editReply({ content: CLOSE_RESULT_MESSAGES[result] });
}

export async function handleCloseConfirm(interaction: ButtonInteraction): Promise<void> {
  if (interaction.inCachedGuild()) await closeFromInteraction(interaction, null);
}

export async function handleCloseSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  await closeFromInteraction(interaction, interaction.fields.getTextInputValue(REASON_FIELD).trim() || null);
}
