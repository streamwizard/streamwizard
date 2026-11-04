import { MessageFlags } from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { reportError } from "@repo/sentry";
import { describeDiscordError } from "@/lib/tickets/manage/actions";
import { handleClaimButton, handleReleaseButton } from "@/lib/tickets/manage/claim";
import {
  handleCloseButton,
  handleCloseCancel,
  handleCloseConfirm,
  handleCloseReasonButton,
  handleCloseSubmit,
} from "@/lib/tickets/close/close";
import {
  handleCloseAcceptButton,
  handleCloseRejectButton,
  handleCloseRequestButton,
} from "@/lib/tickets/close/close-request";
import { handleFeedbackButton, handleFeedbackCommentSubmit } from "@/lib/tickets/close/feedback";
import { parseTicketId, RETIRED_GITHUB_ID, TICKET_IDS } from "./ids";
import { handleCategoryPick, handleCreateButton, handleModalSubmit } from "@/lib/tickets/open/open";

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
} from "@/lib/tickets/manage/actions";
export { archiveMessageDeletes, archiveMessageUpdate, archiveNewMessage } from "@/lib/tickets/transcript/archive";
export { claimTicketAs, type ClaimTicketResult } from "@/lib/tickets/manage/claim";
export { buildTranscriptFile } from "@/lib/tickets/close/close-dm";
export {
  CLOSE_REASON_MAX,
  CLOSE_RESULT_MESSAGES,
  closeOrphanedTicket,
  closeTicketChannel,
  closeTicketsOfDepartedMember,
  finalizeTicketClose,
  type CloseTicketResult,
} from "@/lib/tickets/close/close";
export {
  acceptCloseRequest,
  canCloseDirectly,
  closeMode,
  rejectCloseRequest,
  requestClose,
  type CloseMode,
} from "@/lib/tickets/close/close-request";
export { findCategory, getTicketConfig, invalidateTicketConfig, saveTicketSettings } from "./config";
export { logTicketReply } from "./events";
export { TICKET_IDS } from "./ids";
export { findDmTicketGuild, handleCreate } from "@/lib/tickets/open/open";
export { peekPendingOpen, setPendingOpen, takePendingOpen } from "@/lib/tickets/open/pending";
export { matchTags, searchTags } from "./tags";
export { deleteTicketPanel, NO_PANEL, panelLocation, postTicketPanel } from "@/lib/tickets/panel/panel";
export { isStaff } from "./staff";
export { ticketStatsValues } from "./stats";
export { startTicketSweeper, stopTicketSweeper, sweepGuildTickets } from "@/lib/tickets/automation/sweeper";

export type TicketInteraction = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

// Single entry point used by interactionCreate for all ticket: component interactions.
export async function handleTicketInteraction(interaction: TicketInteraction): Promise<void> {
  const { action, arg } = parseTicketId(interaction.customId);
  try {
    // The closing DM's rating and comment come from outside any guild; everything below assumes one.
    if (interaction.isButton() && action === TICKET_IDS.feedback) return void (await handleFeedbackButton(interaction));
    if (interaction.isModalSubmit() && action === TICKET_IDS.feedbackComment) {
      return void (await handleFeedbackCommentSubmit(interaction, arg));
    }

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
      case TICKET_IDS.closeRequest:
        await handleCloseRequestButton(interaction);
        break;
      case TICKET_IDS.closeAccept:
        await handleCloseAcceptButton(interaction);
        break;
      case TICKET_IDS.closeReject:
        await handleCloseRejectButton(interaction);
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
