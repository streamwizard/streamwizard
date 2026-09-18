import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ButtonInteraction, Client, Guild, ModalSubmitInteraction } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { commentTicketFeedback, rateTicket, TICKET_FEEDBACK_COMMENT_MAX } from "@repo/supabase/queries/ticket-lifecycle";
import { getTicketById } from "@repo/supabase/queries/tickets";
import { recordTicketEvent } from "./events";
import { TICKET_IDS, ticketId } from "./ids";

// The opener's rating from the closing DM. These interactions arrive in a DM,
// so there is no guild or member on them: the ticket row says which server it
// was and who may rate it, and both writes are conditional on it being the
// opener's first rating.

const RATINGS = [1, 2, 3, 4, 5] as const;
const STAR = "⭐";
const COMMENT_FIELD = "comment";

/** The five rating buttons under the closing DM. */
export function feedbackRow(ticket: { id: string }): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    RATINGS.map((rating) =>
      new ButtonBuilder()
        .setCustomId(ticketId(TICKET_IDS.feedback, `${ticket.id}:${rating}`))
        .setLabel(String(rating))
        .setEmoji(STAR)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

/** "<ticketId>:<n>" from the button's arg. Null when it isn't one. */
export function parseFeedbackArg(arg: string | null): { ticketId: string; rating: number } | null {
  const match = /^([0-9a-f-]{36}):([1-5])$/.exec(arg ?? "");
  return match ? { ticketId: match[1]!, rating: Number(match[2]) } : null;
}

const guildOf = (client: Client, guildId: string): Guild | null => client.guilds.cache.get(guildId) ?? null;

export async function handleFeedbackButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseFeedbackArg(interaction.customId.slice(TICKET_IDS.feedback.length + 1) || null);
  if (!parsed) return;

  const rated = await rateTicket(supabase, parsed.ticketId, interaction.user.id, parsed.rating);
  if (!rated) {
    const existing = await getTicketById(supabase, parsed.ticketId);
    const content =
      existing?.opener_discord_user_id === interaction.user.id && existing.feedback_rating
        ? `You already rated this ticket ${existing.feedback_rating}/5. Thanks!`
        : "This rating isn't yours to give.";
    await interaction.reply({ content });
    return;
  }

  // The DM message is the bot's own: swap the buttons for the outcome before the form opens.
  await interaction.message
    .edit({ content: `${interaction.message.content}\n\n${STAR.repeat(parsed.rating)} You rated this ticket ${parsed.rating}/5. Thanks!`.slice(0, 2000), components: [] })
    .catch(() => {});

  const guild = guildOf(interaction.client, rated.guild_id);
  if (guild) {
    // No member object in a DM; the actor is recorded by id and stored name.
    await recordTicketEvent(guild, rated, "feedback_submitted", null, "discord", {
      targetDiscordId: rated.opener_discord_user_id,
      targetName: rated.opener_name,
      detail: { rating: parsed.rating },
    }).catch((error) => reportError(error, "discord-bot tickets: feedback event", { ticketId: rated.id }));
  }

  const comment = new LabelBuilder()
    .setLabel("Anything you'd like to add? (optional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(COMMENT_FIELD)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("What went well, what didn't")
        .setMaxLength(TICKET_FEEDBACK_COMMENT_MAX)
        .setRequired(false),
    );
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(ticketId(TICKET_IDS.feedbackComment, rated.id))
      .setTitle(`Ticket #${String(rated.ticket_number).padStart(4, "0")}: a comment?`)
      .addLabelComponents(comment),
  );
}

export async function handleFeedbackCommentSubmit(interaction: ModalSubmitInteraction, arg: string | null): Promise<void> {
  if (!arg) return;
  const text = interaction.fields.getTextInputValue(COMMENT_FIELD).trim();
  if (!text) {
    await interaction.reply({ content: "Thanks for the rating!" });
    return;
  }

  const commented = await commentTicketFeedback(supabase, arg, interaction.user.id, text);
  if (!commented) {
    await interaction.reply({ content: "Couldn't attach that comment: rate the ticket first, and only once." });
    return;
  }
  await interaction.reply({ content: "Thanks, your comment is with the team." });

  const guild = guildOf(interaction.client, commented.guild_id);
  if (guild) {
    await recordTicketEvent(guild, commented, "feedback_submitted", null, "discord", {
      targetDiscordId: commented.opener_discord_user_id,
      targetName: commented.opener_name,
      detail: { rating: commented.feedback_rating, comment: text.slice(0, 300) },
    }).catch((error) => reportError(error, "discord-bot tickets: feedback comment event", { ticketId: commented.id }));
  }
}
