import { createFeedback } from "@repo/supabase";
import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ModalSubmitInteraction } from "discord.js";
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from "../config/ticket";

export async function handleTicketModal(interaction: ModalSubmitInteraction) {
  const [, category, priority] = interaction.customId.split(":") as [string, keyof typeof CATEGORY_CONFIG, keyof typeof PRIORITY_CONFIG];

  const title = interaction.fields.getTextInputValue("ticket_title");
  const description = interaction.fields.getTextInputValue("ticket_description");

  const categoryInfo = CATEGORY_CONFIG[category];
  const priorityInfo = PRIORITY_CONFIG[priority];

  // Build a rich embed for the ticket confirmation
  const embed = new EmbedBuilder()
    .setTitle(`${categoryInfo.emoji} ${title}`)
    .setDescription(description)
    .setColor(categoryInfo.color)
    .addFields(
      { name: "Category", value: `${categoryInfo.emoji} ${categoryInfo.label}`, inline: true },
      { name: "Priority", value: `${priorityInfo.emoji} ${priorityInfo.label}`, inline: true },
      { name: "Submitted by", value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `Ticket from ${interaction.user.tag}` });

  await interaction.reply({
    content: "✅ **Ticket submitted!** We'll get back to you soon.",
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });

  await createFeedback({
    title,
    description,
    discord: interaction.user.tag,
    category,
    priority,
  });
}
