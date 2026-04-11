import type { ChatInputCommandInteraction } from "discord.js";

export async function handlePing(interaction: ChatInputCommandInteraction) {
  await interaction.reply("Pong! 🏓");
}
