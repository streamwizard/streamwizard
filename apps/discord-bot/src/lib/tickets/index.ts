import { MessageFlags } from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { reportError } from "@repo/sentry";
import { handleClaimButton } from "./claim";
import { handleCloseButton, handleCloseCancel, handleCloseConfirm } from "./close";
import { RETIRED_GITHUB_ID, TICKET_IDS } from "./ids";
import { handleCreateButton, handleModalSubmit } from "./open";

export { claimTicketAs, type ClaimTicketResult } from "./claim";
export {
  CLOSE_RESULT_MESSAGES,
  closeOrphanedTicket,
  closeTicketChannel,
  finalizeTicketClose,
  type CloseTicketResult,
} from "./close";
export { logTicketReply } from "./events";
export { TICKET_IDS } from "./ids";
export { buildPanelMessage, deleteTicketPanel, postTicketPanel } from "./panel";
export { isStaff } from "./staff";

// Single entry point used by interactionCreate for all ticket: component interactions.
export async function handleTicketInteraction(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === TICKET_IDS.submit) await handleModalSubmit(interaction);
      return;
    }

    switch (interaction.customId) {
      case TICKET_IDS.create:
        await handleCreateButton(interaction);
        break;
      case TICKET_IDS.claim:
        await handleClaimButton(interaction);
        break;
      case TICKET_IDS.close:
        await handleCloseButton(interaction);
        break;
      case TICKET_IDS.closeConfirm:
        await handleCloseConfirm(interaction);
        break;
      case TICKET_IDS.closeCancel:
        await handleCloseCancel(interaction);
        break;
      case RETIRED_GITHUB_ID:
        await interaction.reply({
          content: "Moving tickets to GitHub isn't available anymore.",
          flags: MessageFlags.Ephemeral,
        });
        break;
    }
  } catch (error) {
    reportError(error, "discord-bot tickets: interaction", { customId: interaction.customId });

    const payload = {
      content: "Something went wrong with that ticket action.",
      flags: MessageFlags.Ephemeral,
    } as const;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else if (!interaction.isModalSubmit() || interaction.isFromMessage()) {
      await interaction.reply(payload).catch(() => {});
    }
  }
}
