import {
  ActionRowBuilder,
  ChannelType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import type { TicketCategory, TicketProduct } from "@repo/supabase/queries/ticket-config";
import {
  closeTicket,
  createTicket,
  getTicketOpenerProfile,
  nextTicketNumber,
  ticketChannelName,
} from "@repo/supabase/queries/tickets";
import { markSelfAction } from "../server-log/self-actions";
import { notifyTicketActivity, trackTicketChannel } from "../ticket-activity";
import { activeCategories, activeProducts, getTicketConfig, ticketsReady, type TicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { FIELD_IDS, TICKET_IDS, ticketId } from "./ids";
import { buildTicketIntroMessage } from "./intro";

const NOT_SET_UP = "Ticketing isn't set up in this server yet.";
const CATEGORY_GONE = "That ticket category isn't available anymore. Hit Create Ticket again to pick another.";

/** A category or product as a select option. Discord rejects an empty description, so it is left off. */
function selectOption(option: { slug: string; emoji: string | null; description: string }, label: string) {
  return {
    label,
    value: option.slug,
    ...(option.description ? { description: option.description } : {}),
    ...(option.emoji ? { emoji: option.emoji } : {}),
  };
}

/** The form for one category. The product question is skipped when the guild has no products. */
export function buildTicketModal(category: TicketCategory, products: TicketProduct[]): ModalBuilder {
  const subject = new LabelBuilder()
    .setLabel("Subject")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.subject)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("A short summary of your issue")
        .setMaxLength(100)
        .setRequired(true),
    );

  const description = new LabelBuilder()
    .setLabel("Description")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.description)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Tell us what's going on, with as much detail as you can")
        .setMaxLength(2000)
        .setRequired(true),
    );

  const modal = new ModalBuilder()
    .setCustomId(ticketId(TICKET_IDS.submit, category.slug))
    .setTitle(category.name.slice(0, 45))
    .addLabelComponents(subject, description);

  if (products.length > 0) {
    modal.addLabelComponents(
      new LabelBuilder().setLabel("Product").setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId(FIELD_IDS.product)
          .setPlaceholder("What is this about?")
          .setMinValues(1)
          .setMaxValues(1)
          .setRequired(true)
          .addOptions(products.map((product) => selectOption(product, product.label))),
      ),
    );
  }

  return modal;
}

function buildCategoryPicker(categories: TicketCategory[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(TICKET_IDS.pickCategory)
    .setPlaceholder("Pick a category")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(categories.map((category) => selectOption(category, category.name)));

  return {
    content: "What kind of ticket is this?",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  } as const;
}

/**
 * The panel button. With a category slug it opens that category's form. Bare
 * (the single Create Ticket button, including panels posted before categories
 * were configurable) it asks which category first, unless there is only one.
 */
export async function handleCreateButton(interaction: ButtonInteraction, slug: string | null): Promise<void> {
  if (!interaction.inCachedGuild()) return;

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
  await interaction.showModal(buildTicketModal(category, activeProducts(config)));
}

export async function handleCategoryPick(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const config = await getTicketConfig(interaction.guildId);
  const category = activeCategories(config).find((c) => c.slug === interaction.values[0]);
  if (!ticketsReady(config.settings) || !category) {
    await interaction.update({ content: CATEGORY_GONE, components: [] });
    return;
  }
  await interaction.showModal(buildTicketModal(category, activeProducts(config)));
}

/** The category a submitted form belongs to: from the customId, or from the form itself for one opened before the deploy that moved it. */
function submittedCategory(interaction: ModalSubmitInteraction, config: TicketConfig, slug: string | null) {
  const fromForm = interaction.fields.fields.has(FIELD_IDS.category)
    ? interaction.fields.getStringSelectValues(FIELD_IDS.category)[0]
    : null;
  const picked = slug ?? fromForm;
  return activeCategories(config).find((category) => category.slug === picked);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction, slug: string | null): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const config = await getTicketConfig(interaction.guildId);
  const { settings } = config;
  if (!ticketsReady(settings)) {
    await interaction.reply({ content: NOT_SET_UP, flags: MessageFlags.Ephemeral });
    return;
  }

  const category = submittedCategory(interaction, config, slug);
  if (!category) {
    await interaction.reply({ content: CATEGORY_GONE, flags: MessageFlags.Ephemeral });
    return;
  }

  // Where the channel goes: the category's own Discord category, else the server-wide one.
  const parent = category.discord_category_id ?? settings.category_id;
  if (!parent) {
    await interaction.reply({ content: NOT_SET_UP, flags: MessageFlags.Ephemeral });
    return;
  }

  const subject = interaction.fields.getTextInputValue(FIELD_IDS.subject);
  const description = interaction.fields.getTextInputValue(FIELD_IDS.description);
  // A product archived while the form was open is dropped rather than stored.
  const pickedProduct = interaction.fields.fields.has(FIELD_IDS.product)
    ? interaction.fields.getStringSelectValues(FIELD_IDS.product)[0]
    : null;
  const product = activeProducts(config).find((p) => p.slug === pickedProduct)?.slug ?? null;

  // Defer ephemerally: channel creation + DB writes can take a moment.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      subject,
      description,
      category: category.slug,
      product,
      openerName: interaction.member.displayName,
    });
    ticketCreated = true;
    await recordTicketEvent(interaction.guild, ticket, "opened", interaction.member, "discord");
    trackTicketChannel(interaction.guildId, channel.id, ticket.ticket_number);
    void notifyTicketActivity(interaction.guildId, channel.id, "opened", ticket.ticket_number);

    await channel.send(buildTicketIntroMessage(ticket, config, openerProfile));
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
