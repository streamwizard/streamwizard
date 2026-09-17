import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from "discord.js";
import type { APIEmbed, GuildMember, Message } from "discord.js";
import {
  parseTicketOpening,
  resolveMessage,
  TICKET_OPENING_MAX_EMBEDS,
  toApiEmbed,
  type VariableValues,
} from "@repo/discord-message";
import { ticketOptionLabel, type TicketAnswerInput } from "@repo/supabase/queries/ticket-config";
import { formatTicketNumber, type DiscordTicket, type TicketOpenerProfile } from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../branding";
import { memberVariableValues } from "../built-message";
import { findCategory, findProduct, type TicketConfig } from "./config";
import { TICKET_IDS } from "./ids";

const CLAIMED_BY = "Claimed by";
/** Discord: 25 fields per embed, 1024 characters per field value. */
const MAX_ANSWER_FIELDS = 20;
const FIELD_VALUE_MAX = 1024;

// Shows whether the opener has a linked StreamWizard account, and who, so staff
// can match the ticket to a StreamWizard user instead of just a Discord handle.
function accountFieldValue(opener: TicketOpenerProfile | null): string {
  if (!opener) return "❌ Not linked";
  return `✅ Linked — **${opener.name}** (${opener.email})`;
}

const claimedByValue = (ticket: DiscordTicket) =>
  ticket.claimed_by_discord_user_id ? `<@${ticket.claimed_by_discord_user_id}>` : "Unclaimed";

function buttonRow(ticket: DiscordTicket): ActionRowBuilder<ButtonBuilder> {
  // Once claimed, the button becomes a disabled marker showing it's taken.
  const claim = new ButtonBuilder()
    .setCustomId(TICKET_IDS.claim)
    .setEmoji("🙋")
    .setStyle(ButtonStyle.Success)
    .setLabel(ticket.claimed_by_discord_user_id ? "Claimed" : "Claim")
    .setDisabled(Boolean(ticket.claimed_by_discord_user_id));

  const close = new ButtonBuilder()
    .setCustomId(TICKET_IDS.close)
    .setLabel("Close Ticket")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(claim, close);
}

/** What [ticket.*] placeholders in a category's opening message turn into. */
export function ticketVariableValues(ticket: DiscordTicket, config: TicketConfig): VariableValues {
  return {
    "ticket.number": formatTicketNumber(ticket.ticket_number),
    "ticket.category": escapeMarkdown(findCategory(config, ticket.category)?.name ?? ticket.category),
    "ticket.product": escapeMarkdown(findProduct(config, ticket.product)?.label ?? ticket.product ?? "Not set"),
    "ticket.subject": escapeMarkdown(ticket.subject),
  };
}

/** The category's designed opening embeds, placeholders filled. Empty when it has none. */
function openingEmbeds(ticket: DiscordTicket, config: TicketConfig, member: GuildMember): APIEmbed[] {
  const opening = parseTicketOpening(findCategory(config, ticket.category)?.opening_message);
  if (!opening) return [];
  const resolved = resolveMessage(opening, { ...memberVariableValues(member), ...ticketVariableValues(ticket, config) });
  return resolved.elements
    .flatMap((element) => (element.type === "embed" ? [toApiEmbed(element)] : []))
    .slice(0, TICKET_OPENING_MAX_EMBEDS);
}

/** The ticket card: what was asked and answered, and who has it. Always the last embed of the intro. */
function ticketCard(
  ticket: DiscordTicket,
  config: TicketConfig,
  opener: TicketOpenerProfile | null,
  { answers, description }: { answers: TicketAnswerInput[]; description: string },
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `Ticket ${formatTicketNumber(ticket.ticket_number)}` })
    .setTitle(ticket.subject.slice(0, 256))
    .setTimestamp(new Date(ticket.created_at));

  // What the form's description field held. The ticket row's description can
  // be the answers written out (storedDescription); the fields below carry those.
  if (description) embed.setDescription(description.slice(0, 4096));

  embed.addFields(
    ...answers.slice(0, MAX_ANSWER_FIELDS).map((answer) => ({
      name: answer.label.slice(0, 256),
      value: answer.value.slice(0, FIELD_VALUE_MAX),
      inline: false,
    })),
    { name: "Product", value: ticketOptionLabel(findProduct(config, ticket.product), ticket.product), inline: true },
    { name: "Category", value: ticketOptionLabel(findCategory(config, ticket.category), ticket.category), inline: true },
    { name: "StreamWizard account", value: accountFieldValue(opener), inline: true },
    { name: CLAIMED_BY, value: claimedByValue(ticket), inline: true },
  );
  return embed;
}

/**
 * The first message in a ticket channel: the category's opening embeds (if it
 * has any), then the ticket card with the Claim and Close buttons.
 */
export function buildTicketIntroMessage(
  ticket: DiscordTicket,
  config: TicketConfig,
  opener: TicketOpenerProfile | null,
  { member, ...form }: { answers: TicketAnswerInput[]; description: string; member: GuildMember },
) {
  const mentions = [`<@${ticket.opener_discord_user_id}>`];
  if (config.settings?.staff_role_id) mentions.push(`<@&${config.settings.staff_role_id}>`);

  return {
    content: mentions.join(" "),
    embeds: [...openingEmbeds(ticket, config, member), ticketCard(ticket, config, opener, form)],
    components: [buttonRow(ticket)],
  };
}

/**
 * The intro message with its claim state brought up to date. Everything else
 * is kept as posted, so a category or form edited since doesn't rewrite an
 * open ticket's first message.
 */
export function withClaimState(intro: Message, ticket: DiscordTicket) {
  const embeds = intro.embeds.map((embed) => embed.toJSON());
  const card = embeds.at(-1);
  if (card) {
    const fields = card.fields ?? [];
    const claimedBy = fields.find((field) => field.name === CLAIMED_BY);
    if (claimedBy) claimedBy.value = claimedByValue(ticket);
    else fields.push({ name: CLAIMED_BY, value: claimedByValue(ticket), inline: true });
    card.fields = fields;
  }
  return { embeds, components: [buttonRow(ticket)] };
}
