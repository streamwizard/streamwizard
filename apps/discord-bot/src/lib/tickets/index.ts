import { MessageFlags } from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { reportError } from "@repo/sentry";
import { describeDiscordError } from "./actions";
import { handleClaimButton, handleReleaseButton } from "./claim";
import {
  handleCloseButton,
  handleCloseCancel,
  handleCloseConfirm,
  handleCloseReasonButton,
  handleCloseSubmit,
} from "./close";
import { parseTicketId, RETIRED_GITHUB_ID, TICKET_IDS } from "./ids";
import { handleCategoryPick, handleCreateButton, handleModalSubmit } from "./open";

export {
  addMember,
  changePriority,
  changeSubject,
  describeDiscordError,
  loadTicketContext,
  moveTicket,
  releaseTicket,
  removeMember,
  transferTicket,
  type TicketActionResult,
} from "./actions";
export { archiveMessageDeletes, archiveMessageUpdate, archiveNewMessage } from "./archive";
export { claimTicketAs, type ClaimTicketResult } from "./claim";
export { buildTranscriptFile } from "./close-dm";
export {
  CLOSE_REASON_MAX,
  CLOSE_RESULT_MESSAGES,
  closeOrphanedTicket,
  closeTicketChannel,
  closeTicketsOfDepartedMember,
  finalizeTicketClose,
  type CloseTicketResult,
} from "./close";
export { findCategory, getTicketConfig, invalidateTicketConfig, saveTicketSettings } from "./config";
export { logTicketReply } from "./events";
export { TICKET_IDS } from "./ids";
export { handleCreate } from "./open";
export { deleteTicketPanel, NO_PANEL, panelLocation, postTicketPanel } from "./panel";
export { isStaff } from "./staff";
export { startTicketSweeper, stopTicketSweeper, sweepGuildTickets } from "./sweeper";

export type TicketInteraction = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

// Single entry point used by interactionCreate for all ticket: component interactions.
export async function handleTicketInteraction(interaction: TicketInteraction): Promise<void> {
  const { action, arg } = parseTicketId(interaction.customId);
  try {
    if (interaction.isModalSubmit()) {
      if (action === TICKET_IDS.submit) await handleModalSubmit(interaction, arg);
      else if (action === TICKET_IDS.closeSubmit) await handleCloseSubmit(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (action === TICKET_IDS.pickCategory) await handleCategoryPick(interaction);
      return;
    }

    switch (action) {
      case TICKET_IDS.create:
        await handleCreateButton(interaction, arg);
        break;
      case TICKET_IDS.claim:
        await handleClaimButton(interaction);
        break;
      case TICKET_IDS.release:
        await handleReleaseButton(interaction);
        break;
      case TICKET_IDS.close:
        await handleCloseButton(interaction);
        break;
      case TICKET_IDS.closeConfirm:
        await handleCloseConfirm(interaction);
        break;
      case TICKET_IDS.closeReason:
        await handleCloseReasonButton(interaction);
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
      content: describeDiscordError(error) ?? "Something went wrong with that ticket action.",
      flags: MessageFlags.Ephemeral,
    } as const;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else if (!interaction.isModalSubmit() || interaction.isFromMessage()) {
      await interaction.reply(payload).catch(() => {});
    }
  }
}
