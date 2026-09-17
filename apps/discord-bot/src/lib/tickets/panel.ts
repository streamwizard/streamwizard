import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { Guild, SendableChannels } from "discord.js";
import type { DiscordTicketSettings } from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../branding";
import { TICKET_IDS } from "./ids";

// The persistent panel members click to open a ticket.
export function buildPanelMessage() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("Need a hand?")
    .setDescription(
      "Open a support ticket and our team will help you out. Click the button below to get started — we'll spin up a private channel just for you.",
    )
    .setFooter({ text: "StreamWizard Support" });

  const button = new ButtonBuilder()
    .setCustomId(TICKET_IDS.create)
    .setLabel("Create Ticket")
    .setEmoji("🎫")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embeds: [embed], components: [row] };
}

type PanelLocation = Pick<DiscordTicketSettings, "panel_channel_id" | "panel_message_id">;

// Removes a previously posted panel message. Errors are swallowed: the message
// or its channel may already be gone.
export async function deleteTicketPanel(guild: Guild, previous: PanelLocation | null): Promise<void> {
  if (!previous?.panel_channel_id || !previous.panel_message_id) return;
  const oldChannel = await guild.channels.fetch(previous.panel_channel_id).catch(() => null);
  if (oldChannel?.isTextBased()) {
    await oldChannel.messages.delete(previous.panel_message_id).catch(() => {});
  }
}

// Posts a fresh panel and removes the one from a previous setup run, so
// re-running setup doesn't leave duplicate "Create Ticket" panels around.
// Returns the new panel's message id.
export async function postTicketPanel(
  guild: Guild,
  channel: SendableChannels,
  previous: PanelLocation | null,
): Promise<string> {
  await deleteTicketPanel(guild, previous);
  const message = await channel.send(buildPanelMessage());
  return message.id;
}
