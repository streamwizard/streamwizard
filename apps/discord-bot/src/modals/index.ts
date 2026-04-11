import type { ModalSubmitInteraction } from "discord.js";
import { handleTicketModal } from "./ticket-modal";

export async function handleModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId.startsWith("ticket_modal:")) {
    return handleTicketModal(interaction);
  }
}
