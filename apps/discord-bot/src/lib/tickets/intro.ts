import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import {
  formatTicketNumber,
  TICKET_PRODUCTS,
  type DiscordTicket,
  type DiscordTicketCategory,
  type DiscordTicketSettings,
  type TicketOpenerProfile,
} from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../branding";
import { TICKET_IDS } from "./ids";

export const CATEGORY_CHOICES: {
  label: string;
  value: DiscordTicketCategory;
  description: string;
  emoji: string;
}[] = [
  { label: "Bug", value: "bug", description: "Something is broken or not working", emoji: "🐛" },
  { label: "Feature", value: "feature", description: "Request a new feature or improvement", emoji: "✨" },
  { label: "Support", value: "support", description: "Get help with using StreamWizard", emoji: "💬" },
  { label: "Other", value: "other", description: "Anything else", emoji: "📨" },
];

function productLabel(product: string | null): string {
  const choice = TICKET_PRODUCTS.find((p) => p.value === product);
  return choice ? `${choice.emoji} ${choice.label}` : "Not set";
}

function categoryLabel(category: DiscordTicketCategory): string {
  const choice = CATEGORY_CHOICES.find((c) => c.value === category);
  return choice ? `${choice.emoji} ${choice.label}` : category;
}

// Shows whether the opener has a linked StreamWizard account, and who, so staff
// can match the ticket to a StreamWizard user instead of just a Discord handle.
function accountFieldValue(opener: TicketOpenerProfile | null): string {
  if (!opener) return "❌ Not linked";
  return `✅ Linked — **${opener.name}** (${opener.email})`;
}

/** The first message in a ticket channel: the request itself plus the Claim and Close buttons. */
export function buildTicketIntroMessage(
  ticket: DiscordTicket,
  settings: DiscordTicketSettings | null,
  opener: TicketOpenerProfile | null,
) {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `Ticket ${formatTicketNumber(ticket.ticket_number)}` })
    .setTitle(ticket.subject)
    .setDescription(ticket.description)
    .addFields(
      { name: "Product", value: productLabel(ticket.product), inline: true },
      { name: "Category", value: categoryLabel(ticket.category), inline: true },
      { name: "StreamWizard account", value: accountFieldValue(opener), inline: true },
      {
        name: "Claimed by",
        value: ticket.claimed_by_discord_user_id ? `<@${ticket.claimed_by_discord_user_id}>` : "Unclaimed",
        inline: true,
      },
    )
    .setTimestamp(new Date(ticket.created_at));

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

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claim, close);

  const mentions = [`<@${ticket.opener_discord_user_id}>`];
  if (settings?.staff_role_id) mentions.push(`<@&${settings.staff_role_id}>`);

  return { content: mentions.join(" "), embeds: [embed], components: [row] };
}
