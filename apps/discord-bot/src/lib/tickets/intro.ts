import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { ticketOptionLabel } from "@repo/supabase/queries/ticket-config";
import { formatTicketNumber, type DiscordTicket, type TicketOpenerProfile } from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../branding";
import { findCategory, findProduct, type TicketConfig } from "./config";
import { TICKET_IDS } from "./ids";

// Shows whether the opener has a linked StreamWizard account, and who, so staff
// can match the ticket to a StreamWizard user instead of just a Discord handle.
function accountFieldValue(opener: TicketOpenerProfile | null): string {
  if (!opener) return "❌ Not linked";
  return `✅ Linked — **${opener.name}** (${opener.email})`;
}

/** The first message in a ticket channel: the request itself plus the Claim and Close buttons. */
export function buildTicketIntroMessage(
  ticket: DiscordTicket,
  config: TicketConfig,
  opener: TicketOpenerProfile | null,
) {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `Ticket ${formatTicketNumber(ticket.ticket_number)}` })
    .setTitle(ticket.subject)
    .setDescription(ticket.description)
    .addFields(
      { name: "Product", value: ticketOptionLabel(findProduct(config, ticket.product), ticket.product), inline: true },
      {
        name: "Category",
        value: ticketOptionLabel(findCategory(config, ticket.category), ticket.category),
        inline: true,
      },
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
  if (config.settings?.staff_role_id) mentions.push(`<@&${config.settings.staff_role_id}>`);

  return { content: mentions.join(" "), embeds: [embed], components: [row] };
}
