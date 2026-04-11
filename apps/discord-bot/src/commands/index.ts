import type { ChatInputCommandInteraction } from "discord.js";
import { handlePing } from "./ping";
import { handleTicket } from "./ticket";

export async function handleCommand(interaction: ChatInputCommandInteraction) {
  switch (interaction.commandName) {
    case "ping":
      return handlePing(interaction);
    case "ticket":
      return handleTicket(interaction);
  }
}
