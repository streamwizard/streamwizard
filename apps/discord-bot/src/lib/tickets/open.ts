import {
  ChannelType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import {
  closeTicket,
  createTicket,
  getTicketOpenerProfile,
  getTicketSettings,
  nextTicketNumber,
  ticketChannelName,
  TICKET_PRODUCTS,
  type DiscordTicketCategory,
  type TicketProduct,
} from "@repo/supabase/queries/tickets";
import { markSelfAction } from "../server-log/self-actions";
import { notifyTicketActivity, trackTicketChannel } from "../ticket-activity";
import { recordTicketEvent } from "./events";
import { FIELD_IDS, TICKET_IDS } from "./ids";
import { buildTicketIntroMessage, CATEGORY_CHOICES } from "./intro";

function buildTicketModal(): ModalBuilder {
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

  const category = new LabelBuilder().setLabel("Category").setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(FIELD_IDS.category)
      .setPlaceholder("Pick a category")
      .setMinValues(1)
      .setMaxValues(1)
      .setRequired(true)
      .addOptions(
        CATEGORY_CHOICES.map((c) => ({ label: c.label, value: c.value, description: c.description, emoji: c.emoji })),
      ),
  );

  const product = new LabelBuilder().setLabel("Product").setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(FIELD_IDS.product)
      .setPlaceholder("What is this about?")
      .setMinValues(1)
      .setMaxValues(1)
      .setRequired(true)
      .addOptions(
        TICKET_PRODUCTS.map((p) => ({ label: p.label, value: p.value, description: p.description, emoji: p.emoji })),
      ),
  );

  return new ModalBuilder()
    .setCustomId(TICKET_IDS.submit)
    .setTitle("Create a ticket")
    .addLabelComponents(subject, description, product, category);
}

export async function handleCreateButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!settings?.enabled || !settings.category_id || !settings.staff_role_id) {
    await interaction.reply({ content: "Ticketing isn't set up in this server yet.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.showModal(buildTicketModal());
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!settings?.enabled || !settings.category_id || !settings.staff_role_id) {
    await interaction.reply({ content: "Ticketing isn't set up in this server yet.", flags: MessageFlags.Ephemeral });
    return;
  }

  const subject = interaction.fields.getTextInputValue(FIELD_IDS.subject);
  const description = interaction.fields.getTextInputValue(FIELD_IDS.description);
  const category = interaction.fields.getStringSelectValues(FIELD_IDS.category)[0] as DiscordTicketCategory;
  const pickedProduct = interaction.fields.getStringSelectValues(FIELD_IDS.product)[0];
  const product: TicketProduct = TICKET_PRODUCTS.find((p) => p.value === pickedProduct)?.value ?? "other";

  // Defer ephemerally: channel creation + DB writes can take a moment.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: integration } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);
  const openerUserId = integration?.user_id ?? null;
  const openerProfile = openerUserId ? await getTicketOpenerProfile(supabase, openerUserId) : null;
  const ticketNumber = await nextTicketNumber(supabase, interaction.guildId);

  const channel = await interaction.guild.channels.create({
    name: ticketChannelName(ticketNumber),
    type: ChannelType.GuildText,
    parent: settings.category_id,
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
      category,
      product,
      openerName: interaction.member.displayName,
    });
    ticketCreated = true;
    await recordTicketEvent(interaction.guild, ticket, "opened", interaction.member, "discord");
    trackTicketChannel(interaction.guildId, channel.id, ticket.ticket_number);
    void notifyTicketActivity(interaction.guildId, channel.id, "opened", ticket.ticket_number);

    await channel.send(buildTicketIntroMessage(ticket, settings, openerProfile));
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
