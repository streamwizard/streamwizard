import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets";
import type { Command } from "../types/discord";
import { CLOSE_RESULT_MESSAGES, closeTicketChannel, isStaff, postTicketPanel } from "../lib/tickets";

export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the support ticket system")
    // No default member permissions: Discord can't set them per subcommand, and
    // hiding the whole command would hide `close` from staff without Manage
    // Server. setup/settings are gated on Manage Server in execute() instead.
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure ticketing and post the ticket panel")
        .addRoleOption((opt) =>
          opt.setName("staff-role").setDescription("Role that can see and manage tickets").setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Category that new ticket channels are created under")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("panel-channel")
            .setDescription("Channel to post the 'Create Ticket' panel in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName("close").setDescription("Close the ticket in this channel"))
    .addSubcommand((sub) => sub.setName("settings").setDescription("Show the current ticket configuration")),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "close" && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "You need Manage Server to configure ticketing.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "setup") {
      const staffRole = interaction.options.getRole("staff-role", true);
      const category = interaction.options.getChannel("category", true);
      const panelChannel = interaction.options.getChannel("panel-channel", true, [ChannelType.GuildText]);

      const previous = await getTicketSettings(supabase, interaction.guildId);
      const panelMessageId = await postTicketPanel(interaction.guild, panelChannel, previous);

      await upsertTicketSettings(supabase, interaction.guildId, {
        enabled: true,
        staff_role_id: staffRole.id,
        category_id: category.id,
        panel_channel_id: panelChannel.id,
        panel_message_id: panelMessageId,
      });

      await interaction.reply({
        content: `✅ Ticketing is set up. Panel posted in <#${panelChannel.id}>, staff role <@&${staffRole.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "close") {
      const settings = await getTicketSettings(supabase, interaction.guildId);
      if (!isStaff(interaction.member, settings)) {
        await interaction.reply({ content: "Only staff can close tickets.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (interaction.channel?.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "This isn't a ticket channel.", flags: MessageFlags.Ephemeral });
        return;
      }

      // Acknowledge before deleting the channel, otherwise the reply target disappears.
      await interaction.reply({ content: "Closing this ticket…", flags: MessageFlags.Ephemeral });
      const result = await closeTicketChannel(interaction.channel, interaction.member);
      if (result !== "closed") {
        await interaction.editReply({ content: CLOSE_RESULT_MESSAGES[result] });
      }
      return;
    }

    // settings
    const settings = await getTicketSettings(supabase, interaction.guildId);
    if (!settings) {
      await interaction.reply({
        content: "Ticketing isn't set up yet. Run `/ticket setup`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = [
      `**Status:** ${settings.enabled ? "enabled" : "disabled"}`,
      `**Staff role:** ${settings.staff_role_id ? `<@&${settings.staff_role_id}>` : "not set"}`,
      `**Category:** ${settings.category_id ? `<#${settings.category_id}>` : "not set"}`,
      `**Panel channel:** ${settings.panel_channel_id ? `<#${settings.panel_channel_id}>` : "not set"}`,
      `**Tickets opened:** ${settings.ticket_counter}`,
      "**Ticket log:** set up in the web-admin dashboard under Discord, Logs.",
    ];
    await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
  },
} satisfies Command;
