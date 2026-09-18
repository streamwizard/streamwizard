import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } from "discord.js";
import type { ButtonInteraction, Guild, GuildMember, TextChannel } from "discord.js";
import { parseTicketMessages, replaceVariables } from "@repo/discord-message";
import { supabase } from "@repo/supabase";
import type { TicketCategory } from "@repo/supabase/queries/ticket-config";
import { clearTicketCloseRequest, listTicketMembers, requestTicketClose } from "@repo/supabase/queries/ticket-lifecycle";
import { getTicketByChannelId, type DiscordTicket, type DiscordTicketSettings } from "@repo/supabase/queries/tickets";
import type { TicketEventSource } from "@repo/types";
import { guildVariableValues, memberVariableValues } from "../built-message";
import { notifyTicketActivity } from "../ticket-activity";
import { loadTicketContext, type TicketActionResult } from "./actions";
import { CLOSE_RESULT_MESSAGES, closeTicketChannel } from "./close";
import { findCategory, getTicketConfig, type TicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { TICKET_IDS } from "./ids";
import { ticketVariableValues } from "./intro";
import { isStaff } from "./staff";

// Who may end a ticket, and the two-party close that "request" mode adds:
// the opener asks, staff accept or reject, and a request nobody answers
// expires (the sweeper does that) with the ticket left open. Every step is a
// conditional write on close_requested_at, so two clicks make one request
// and a reject racing an expiry clears it once.

export const CLOSE_MODES = ["staff_only", "request", "either"] as const;
export type CloseMode = (typeof CLOSE_MODES)[number];

export const closeMode = (settings: DiscordTicketSettings | null): CloseMode =>
  (CLOSE_MODES as readonly string[]).includes(settings?.close_mode ?? "") ? (settings!.close_mode as CloseMode) : "staff_only";

/** Whether `member` may close this ticket outright: staff always, the opener when the server says either. */
export function canCloseDirectly(
  member: GuildMember,
  ticket: DiscordTicket,
  config: TicketConfig,
  category: TicketCategory | null | undefined,
): boolean {
  if (isStaff(member, config.settings, category)) return true;
  return closeMode(config.settings) === "either" && member.id === ticket.opener_discord_user_id;
}

/** The opener, or someone added to the ticket. */
async function isParticipant(member: GuildMember, ticket: DiscordTicket): Promise<boolean> {
  if (member.id === ticket.opener_discord_user_id) return true;
  const members = await listTicketMembers(supabase, ticket.id);
  return members.some((row) => row.discord_user_id === member.id);
}

const NOT_A_TICKET = "This channel isn't an open ticket.";
const NO_REQUEST = "No close request is waiting on this ticket.";
const fail = (message: string): TicketActionResult => ({ ok: false, message });

function requestButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TICKET_IDS.closeAccept).setLabel("Accept and close").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(TICKET_IDS.closeReject).setLabel("Keep it open").setEmoji("↩️").setStyle(ButtonStyle.Secondary),
  );
}

/** The opener (or an added member) asks staff to close. Posts the request with its buttons and pings staff. */
export async function requestClose(
  channel: TextChannel,
  member: GuildMember,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config, category } = context;
  if (closeMode(config.settings) !== "request") return fail("This server doesn't use close requests.");
  if (isStaff(member, config.settings, category)) return fail("You're staff: close the ticket directly.");
  if (!(await isParticipant(member, ticket))) return fail("Only the opener, or someone added to the ticket, can ask to close it.");
  if (ticket.close_requested_at) return fail("A close request is already waiting for staff.");

  const hours = config.settings?.close_request_hours ?? 24;
  const requested = await requestTicketClose(supabase, channel.id, {
    requestedByDiscordUserId: member.id,
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  });
  if (!requested) return fail("A close request is already waiting for staff.");

  const pingRoles = category?.ping_role_ids.length ? category.ping_role_ids : config.settings?.staff_role_id ? [config.settings.staff_role_id] : [];
  const content = replaceVariables(parseTicketMessages(config.settings?.messages).closeRequest, {
    ...guildVariableValues(channel.guild),
    ...memberVariableValues(member),
    ...ticketVariableValues(requested, config),
    "request.hours": String(hours),
  });
  await channel.send({
    content: [content.slice(0, 1900), ...pingRoles.map((id) => `<@&${id}>`)].join("\n"),
    components: [requestButtons()],
    allowedMentions: { users: [member.id], roles: pingRoles },
  });
  await recordTicketEvent(channel.guild, requested, "close_requested", member, source);
  void notifyTicketActivity(channel.guild.id, channel.id, "updated", requested.ticket_number);
  return { ok: true, ticket: requested };
}

/** Staff say yes: the timeline notes it, then the ticket closes like any staff close. */
export async function acceptCloseRequest(
  channel: TextChannel,
  actor: GuildMember,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config, category } = context;
  if (!isStaff(actor, config.settings, category)) return fail("Only staff can answer a close request.");
  if (!ticket.close_requested_at) return fail(NO_REQUEST);

  await recordTicketEvent(channel.guild, ticket, "close_request_accepted", actor, source);
  const result = await closeTicketChannel(channel, actor, source, null);
  if (result !== "closed") return fail(CLOSE_RESULT_MESSAGES[result]);
  return { ok: true, ticket };
}

/** Staff say no: the request is cleared and the ticket stays open. */
export async function rejectCloseRequest(
  channel: TextChannel,
  actor: GuildMember,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config, category } = context;
  if (!isStaff(actor, config.settings, category)) return fail("Only staff can answer a close request.");

  const cleared = await clearTicketCloseRequest(supabase, ticket.id);
  if (!cleared) return fail(NO_REQUEST);
  await channel
    .send({ content: `↩️ ${actor} kept this ticket open. Carry on here.`, allowedMentions: { parse: [] } })
    .catch(() => {});
  await recordTicketEvent(channel.guild, cleared, "close_request_rejected", actor, source, {
    targetDiscordId: ticket.close_requested_by,
  });
  void notifyTicketActivity(channel.guild.id, channel.id, "updated", cleared.ticket_number);
  return { ok: true, ticket: cleared };
}

/** Nobody answered in time: the sweeper clears the request and says so. */
export async function expireCloseRequest(guild: Guild, channelId: string): Promise<boolean> {
  const ticket = await getTicketByChannelId(supabase, channelId);
  if (!ticket || ticket.status !== "open" || !ticket.close_requested_at) return false;
  const cleared = await clearTicketCloseRequest(supabase, ticket.id);
  if (!cleared) return false;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type === ChannelType.GuildText) {
    await channel
      .send({
        content: `⏳ <@${ticket.close_requested_by}> nobody answered your close request in time, so this ticket stays open. Ask again any time.`,
        allowedMentions: { users: ticket.close_requested_by ? [ticket.close_requested_by] : [] },
      })
      .catch(() => {});
  }
  await recordTicketEvent(guild, cleared, "close_request_expired", null, "system", {
    targetDiscordId: ticket.close_requested_by,
  });
  void notifyTicketActivity(guild.id, channelId, "updated", cleared.ticket_number);
  return true;
}

// Buttons. The request button sits on the intro card; accept and reject on
// the request message, which loses its buttons once answered.

export async function handleCloseRequestButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild() || interaction.channel?.type !== ChannelType.GuildText) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await requestClose(interaction.channel, interaction.member);
  await interaction.editReply({ content: result.ok ? "Asked staff to close this ticket. They'll accept or keep it open." : result.message });
}

export async function handleCloseAcceptButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild() || interaction.channel?.type !== ChannelType.GuildText) return;
  const config = await getTicketConfig(interaction.guildId);
  const ticket = await getTicketByChannelId(supabase, interaction.channelId);
  if (!isStaff(interaction.member, config.settings, findCategory(config, ticket?.category))) {
    await interaction.reply({ content: "Only staff can answer a close request.", flags: MessageFlags.Ephemeral });
    return;
  }
  // The buttons go before the channel does; the reply target would vanish otherwise.
  await interaction.update({ components: [] });
  const result = await acceptCloseRequest(interaction.channel, interaction.member);
  if (!result.ok) {
    await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral }).catch(() => {});
    // Not closed after all: give the buttons back.
    await interaction.message.edit({ components: [requestButtons()] }).catch(() => {});
  }
}

export async function handleCloseRejectButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild() || interaction.channel?.type !== ChannelType.GuildText) return;
  const config = await getTicketConfig(interaction.guildId);
  const ticket = await getTicketByChannelId(supabase, interaction.channelId);
  if (!isStaff(interaction.member, config.settings, findCategory(config, ticket?.category))) {
    await interaction.reply({ content: "Only staff can answer a close request.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update({ components: [] });
  const result = await rejectCloseRequest(interaction.channel, interaction.member);
  if (!result.ok) await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral }).catch(() => {});
}
