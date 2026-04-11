import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from "../config/ticket";

export async function handleTicket(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getString("category", true) as keyof typeof CATEGORY_CONFIG;
  const priority = interaction.options.getString("priority", true) as keyof typeof PRIORITY_CONFIG;

  // Build the modal with title and description fields
  const modal = new ModalBuilder().setCustomId(`ticket_modal:${category}:${priority}`).setTitle(`${CATEGORY_CONFIG[category].emoji} New ${CATEGORY_CONFIG[category].label}`);

  const titleInput = new TextInputBuilder()
    .setCustomId("ticket_title")
    .setLabel("Title")
    .setPlaceholder("Brief summary of your ticket")
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(120)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("ticket_description")
    .setLabel("Description")
    .setPlaceholder("Provide as much detail as possible...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(2000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput), new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput));

  await interaction.showModal(modal);
}
