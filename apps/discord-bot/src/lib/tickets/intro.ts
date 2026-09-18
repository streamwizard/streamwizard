import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from "discord.js";
import type { APIEmbed, GuildMember, Message, TextChannel } from "discord.js";
import {
  parseTicketMessages,
  parseTicketOpening,
  replaceVariables,
  resolveMessage,
  TICKET_OPENING_MAX_EMBEDS,
  toApiEmbed,
  type VariableValues,
} from "@repo/discord-message";
import { ticketOptionLabel, type TicketAnswerInput } from "@repo/supabase/queries/ticket-config";
import { parseWorkingHours } from "@repo/supabase/queries/ticket-hours";
import { formatTicketNumber, type DiscordTicket, type TicketOpenerProfile } from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../branding";
import { memberVariableValues } from "../built-message";
import { findCategory, findProduct, type TicketConfig } from "./config";
import { TICKET_IDS } from "./ids";
import { discordRelative, isWithinWorkingHours, nextOpening } from "./working-hours";

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

function buttonRow(ticket: DiscordTicket, config: TicketConfig): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // A category can switch claiming off; its tickets then have no button for it.
  if (findCategory(config, ticket.category)?.claiming_enabled !== false) {
    row.addComponents(
      ticket.claimed_by_discord_user_id
        ? new ButtonBuilder()
            .setCustomId(TICKET_IDS.release)
            .setEmoji("🙌")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Release")
        : new ButtonBuilder().setCustomId(TICKET_IDS.claim).setEmoji("🙋").setStyle(ButtonStyle.Success).setLabel("Claim"),
    );
  }

  row.addComponents(
    new ButtonBuilder().setCustomId(TICKET_IDS.close).setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
  );
  // In request mode the opener can't close, so they get a button to ask.
  if (config.settings?.close_mode === "request") {
    row.addComponents(
      new ButtonBuilder().setCustomId(TICKET_IDS.closeRequest).setLabel("Request close").setEmoji("🙏").setStyle(ButtonStyle.Secondary),
    );
  }
  return row;
}

/**
 * The out-of-hours line under the mentions, when the server has working hours
 * and the ticket opens outside them. Null otherwise.
 */
export function workingHoursNotice(ticket: DiscordTicket, config: TicketConfig, member: GuildMember, now = new Date()): string | null {
  const hours = parseWorkingHours(config.settings?.working_hours);
  if (isWithinWorkingHours(hours, now)) return null;
  const opening = nextOpening(hours, now);
  if (!opening) return null;
  return replaceVariables(parseTicketMessages(config.settings?.messages).workingHoursNotice, {
    ...memberVariableValues(member),
    ...ticketVariableValues(ticket, config),
    "hours.next_opening": discordRelative(opening),
  });
}

const PRIORITY_LABELS: Record<string, string> = { low: "🟢 Low", medium: "🟠 Medium", high: "🔴 High" };

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
  // The category's ping roles, or the server-wide staff role when it has none.
  const category = findCategory(config, ticket.category);
  const pingRoles = category?.ping_role_ids.length
    ? category.ping_role_ids
    : config.settings?.staff_role_id
      ? [config.settings.staff_role_id]
      : [];

  const mentions = [`<@${ticket.opener_discord_user_id}>`, ...pingRoles.map((id) => `<@&${id}>`)].join(" ");
  const notice = workingHoursNotice(ticket, config, member);
  return {
    content: notice ? `${mentions}\n${notice}`.slice(0, 2000) : mentions,
    embeds: [...openingEmbeds(ticket, config, member), ticketCard(ticket, config, opener, form)],
    components: [buttonRow(ticket, config)],
    allowedMentions: { users: [ticket.opener_discord_user_id], roles: pingRoles },
  };
}

/**
 * The intro message brought up to date with the ticket row: subject, category,
 * priority and who has it. The opening embeds and the answers are kept as
 * posted, so a category or form edited since doesn't rewrite an open ticket's
 * first message.
 */
export function withTicketState(intro: Message, ticket: DiscordTicket, config: TicketConfig) {
  const embeds = intro.embeds.map((embed) => embed.toJSON());
  const card = embeds.at(-1);
  if (card) {
    card.title = ticket.subject.slice(0, 256);
    const fields = card.fields ?? [];
    const setField = (name: string, value: string | null) => {
      const index = fields.findIndex((field) => field.name === name);
      if (value === null) {
        if (index >= 0) fields.splice(index, 1);
      } else if (index >= 0) {
        fields[index]!.value = value;
      } else {
        fields.push({ name, value, inline: true });
      }
    };
    setField("Category", ticketOptionLabel(findCategory(config, ticket.category), ticket.category));
    setField(CLAIMED_BY, claimedByValue(ticket));
    setField("Priority", ticket.priority ? (PRIORITY_LABELS[ticket.priority] ?? ticket.priority) : null);
    card.fields = fields;
  }
  return { embeds, components: [buttonRow(ticket, config)] };
}

/** The intro is the bot's oldest message carrying the Close button. Null when it was deleted. */
export async function findIntroMessage(channel: TextChannel): Promise<Message | null> {
  const firstMessages = await channel.messages.fetch({ after: "0", limit: 10 }).catch(() => null);
  return (
    firstMessages?.find(
      (message) =>
        message.author.id === channel.client.user.id &&
        message.components.some(
          (row) => "components" in row && row.components.some((c) => "customId" in c && c.customId === TICKET_IDS.close),
        ),
    ) ?? null
  );
}
