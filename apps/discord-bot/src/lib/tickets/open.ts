import { ActionRowBuilder, ChannelType, MessageFlags, PermissionFlagsBits, StringSelectMenuBuilder } from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import { insertTicketAnswers, type TicketCategory } from "@repo/supabase/queries/ticket-config";
import {
  closeTicket,
  createTicket,
  getTicketOpenerProfile,
  nextTicketNumber,
  ticketChannelName,
} from "@repo/supabase/queries/tickets";
import { reportError } from "@repo/sentry";
import { markSelfAction } from "../server-log/self-actions";
import { notifyTicketActivity, trackTicketChannel } from "../ticket-activity";
import {
  activeCategories,
  activeProducts,
  categoryFields,
  getTicketConfig,
  ticketsReady,
  type TicketConfig,
} from "./config";
import { recordTicketEvent } from "./events";
import { buildTicketModal, readTicketForm, storedDescription, type FormReader, type TicketFormResult } from "./form";
import { FIELD_IDS, TICKET_IDS } from "./ids";
import { buildTicketIntroMessage } from "./intro";

const NOT_SET_UP = "Ticketing isn't set up in this server yet.";
const CATEGORY_GONE = "That ticket category isn't available anymore. Hit Create Ticket again to pick another.";
const FORM_CHANGED = "The ticket form changed while you had it open. Hit Create Ticket again, it only takes a moment.";

type OpenInteraction = ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached">;

function buildCategoryPicker(categories: TicketCategory[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(TICKET_IDS.pickCategory)
    .setPlaceholder("Pick a category")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      categories.map((category) => ({
        label: category.name,
        value: category.slug,
        // Discord rejects an empty description, so it is left off.
        ...(category.description ? { description: category.description } : {}),
        ...(category.emoji ? { emoji: category.emoji } : {}),
      })),
    );

  return {
    content: "What kind of ticket is this?",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  } as const;
}

/** Shows the category's form, or opens the ticket straight away when the form asks nothing. */
async function startTicket(interaction: OpenInteraction, config: TicketConfig, category: TicketCategory): Promise<void> {
  const modal = buildTicketModal(category, categoryFields(config, category), activeProducts(config));
  if (modal) {
    await interaction.showModal(modal);
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await openTicket(interaction, config, category, {
    subject: category.name,
    description: "",
    product: null,
    answers: [],
  });
}

/**
 * The panel. With a category slug (a per-category button, a select menu
 * option) it goes to that category. Bare (the single Create Ticket button,
 * including panels posted before categories were configurable) it asks which
 * category first, unless there is only one.
 */
export async function handleCreate(interaction: OpenInteraction, slug: string | null): Promise<void> {
  const config = await getTicketConfig(interaction.guildId);
  const categories = activeCategories(config);
  if (!ticketsReady(config.settings) || categories.length === 0) {
    await interaction.reply({ content: NOT_SET_UP, flags: MessageFlags.Ephemeral });
    return;
  }

  if (slug === null && categories.length > 1) {
    await interaction.reply(buildCategoryPicker(categories));
    return;
  }

  const category = slug === null ? categories[0] : categories.find((c) => c.slug === slug);
  if (!category) {
    await interaction.reply({ content: CATEGORY_GONE, flags: MessageFlags.Ephemeral });
    return;
  }
  await startTicket(interaction, config, category);
}

export async function handleCreateButton(interaction: ButtonInteraction, slug: string | null): Promise<void> {
  if (interaction.inCachedGuild()) await handleCreate(interaction, slug);
}

/** A category chosen from a select: the bot's own "which category?" prompt, or a menu-style panel. */
export async function handleCategoryPick(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  await handleCreate(interaction, interaction.values[0] ?? null);

  // A menu on the panel keeps showing this member's pick. Sending the same
  // components again clears it, so the next ticket starts from the placeholder.
  if (!interaction.message.flags.has(MessageFlags.Ephemeral)) {
    const rows = interaction.message.components.map((row) => row.toJSON());
    await interaction.message.edit({ components: rows }).catch(() => {});
  }
}

/** Reads a submitted modal by field id. A field the modal never had reads as null. */
function modalReader(interaction: ModalSubmitInteraction): FormReader {
  const has = (id: string) => interaction.fields.fields.has(id);
  return {
    text: (id) => (has(id) ? interaction.fields.getTextInputValue(id) : null),
    select: (id) => (has(id) ? (interaction.fields.getStringSelectValues(id)[0] ?? "") : null),
  };
}

/**
 * A form opened before forms were configurable asks under fixed ids instead of
 * field ids. It is read by kind, so a member mid-form during that deploy still
 * gets their ticket.
 */
function legacyReader(interaction: ModalSubmitInteraction, config: TicketConfig, category: TicketCategory): FormReader {
  const byId = new Map(categoryFields(config, category).map((field) => [field.id, field.kind]));
  const legacyId = (id: string) => {
    const kind = byId.get(id);
    return kind === "subject" || kind === "description" || kind === "product" ? FIELD_IDS[kind] : null;
  };
  const has = (id: string | null): id is string => id !== null && interaction.fields.fields.has(id);
  return {
    text: (id) => (has(legacyId(id)) ? interaction.fields.getTextInputValue(legacyId(id)!) : null),
    select: (id) => (has(legacyId(id)) ? (interaction.fields.getStringSelectValues(legacyId(id)!)[0] ?? "") : null),
  };
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction, slug: string | null): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const config = await getTicketConfig(interaction.guildId);
  if (!ticketsReady(config.settings)) {
    await interaction.reply({ content: NOT_SET_UP, flags: MessageFlags.Ephemeral });
    return;
  }

  // A bare submit id is a form from before the category moved out of the modal.
  const isLegacy = slug === null;
  const pickedSlug =
    slug ??
    (interaction.fields.fields.has(FIELD_IDS.category)
      ? interaction.fields.getStringSelectValues(FIELD_IDS.category)[0]
      : null);
  const category = activeCategories(config).find((c) => c.slug === pickedSlug);
  if (!category) {
    await interaction.reply({ content: CATEGORY_GONE, flags: MessageFlags.Ephemeral });
    return;
  }

  const form = readTicketForm(
    category,
    categoryFields(config, category),
    activeProducts(config),
    isLegacy ? legacyReader(interaction, config, category) : modalReader(interaction),
  );
  if (form === "stale") {
    await interaction.reply({ content: FORM_CHANGED, flags: MessageFlags.Ephemeral });
    return;
  }

  // Defer ephemerally: channel creation + DB writes can take a moment.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await openTicket(interaction, config, category, form);
}

/** Creates the channel, the ticket row and the opening message. The interaction is already deferred. */
async function openTicket(
  interaction: OpenInteraction | ModalSubmitInteraction<"cached">,
  config: TicketConfig,
  category: TicketCategory,
  form: TicketFormResult,
): Promise<void> {
  const { settings } = config;
  // Where the channel goes: the category's own Discord category, else the server-wide one.
  const parent = category.discord_category_id ?? settings?.category_id;
  if (!ticketsReady(settings) || !parent) {
    await interaction.editReply({ content: NOT_SET_UP });
    return;
  }

  const { data: integration } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);
  const openerUserId = integration?.user_id ?? null;
  const openerProfile = openerUserId ? await getTicketOpenerProfile(supabase, openerUserId) : null;
  const ticketNumber = await nextTicketNumber(supabase, interaction.guildId);

  const channel = await interaction.guild.channels.create({
    name: ticketChannelName(ticketNumber),
    type: ChannelType.GuildText,
    parent,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: settings.staff_role_id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });
  // The server log would otherwise report the new channel as a staff action.
  markSelfAction("channel", channel.id);

  // If the ticket row or intro message fails, the channel would be left behind
  // with nothing tracking it — remove it (and close the row, if it got that far)
  // and let the handler report the error. The allocated ticket number is skipped.
  let ticketCreated = false;
  try {
    const ticket = await createTicket(supabase, {
      guildId: interaction.guildId,
      ticketNumber,
      channelId: channel.id,
      openerDiscordUserId: interaction.user.id,
      openerUserId,
      subject: form.subject,
      description: storedDescription(form),
      category: category.slug,
      product: form.product,
      openerName: interaction.member.displayName,
    });
    ticketCreated = true;
    // Answers are history for the dashboard; the ticket works without them.
    await insertTicketAnswers(supabase, ticket.id, form.answers).catch((error) =>
      reportError(error, "discord-bot tickets: save answers", { ticketId: ticket.id }),
    );
    await recordTicketEvent(interaction.guild, ticket, "opened", interaction.member, "discord");
    trackTicketChannel(interaction.guildId, channel.id, ticket.ticket_number);
    void notifyTicketActivity(interaction.guildId, channel.id, "opened", ticket.ticket_number);

    await channel.send(
      buildTicketIntroMessage(ticket, config, openerProfile, {
        answers: form.answers,
        description: form.description,
        member: interaction.member,
      }),
    );
  } catch (error) {
    if (ticketCreated) {
      // Closed straight in the DB, not through finalizeTicketClose: a ticket
      // that never got its intro message shouldn't reach the log as a close.
      await closeTicket(supabase, channel.id, {
        code: "force",
        reason: "Ticket creation failed",
        closedByDiscordUserId: interaction.client.user.id,
        closedByName: interaction.client.user.username,
      }).catch(() => {});
      trackTicketChannel(interaction.guildId, channel.id, null);
    }
    await channel.delete("Ticket creation failed").catch(() => {});
    throw error;
  }

  await interaction.editReply({ content: `✅ Your ticket is open: <#${channel.id}>` });
}
