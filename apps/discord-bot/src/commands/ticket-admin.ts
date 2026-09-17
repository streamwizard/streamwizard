import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { isActiveCategory } from "@repo/supabase/queries/ticket-config";
import { getTicketSettings } from "@repo/supabase/queries/tickets";
import type { Command } from "../types/discord";
import { getTicketConfig, panelLocation, postTicketPanel, saveTicketSettings } from "../lib/tickets";

// Setting tickets up. Its own command, apart from /ticket, so Discord can hide
// it from everyone without Manage Server: default permissions are per command,
// not per subcommand, and /ticket has to stay visible to members and staff.
export default {
  data: new SlashCommandBuilder()
    .setName("ticket-admin")
    .setDescription("Set up the support ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
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
    .addSubcommand((sub) => sub.setName("settings").setDescription("Show the current ticket configuration")),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    // Default member permissions are only a default: an admin can open the
    // command to anyone under Server Settings > Integrations.
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "You need Manage Server to configure ticketing.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() === "setup") {
      const staffRole = interaction.options.getRole("staff-role", true);
      const category = interaction.options.getChannel("category", true);
      const panelChannel = interaction.options.getChannel("panel-channel", true, [ChannelType.GuildText]);

      // Posting the panel can take longer than Discord waits for a first answer.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Settings first: a guild's first save seeds its categories, and the panel is built from them.
      const previous = await getTicketSettings(supabase, interaction.guildId);
      await saveTicketSettings(interaction.guildId, {
        enabled: true,
        staff_role_id: staffRole.id,
        category_id: category.id,
      });
      const posted = await postTicketPanel(interaction.guild, panelChannel, previous);
      await saveTicketSettings(interaction.guildId, panelLocation(panelChannel.id, posted));

      await interaction.editReply({
        content: `✅ Ticketing is set up. Panel posted in <#${panelChannel.id}>, staff role <@&${staffRole.id}>. Categories, the form and the panel's look are in the web-admin dashboard under Discord, Tickets.`,
      });
      return;
    }

    // settings
    const { settings, categories } = await getTicketConfig(interaction.guildId);
    if (!settings) {
      await interaction.reply({
        content: "Ticketing isn't set up yet. Run `/ticket-admin setup`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const active = categories.filter(isActiveCategory);
    const lines = [
      `**Status:** ${settings.enabled ? "enabled" : "disabled"}`,
      `**Staff role:** ${settings.staff_role_id ? `<@&${settings.staff_role_id}>` : "not set"}`,
      `**Category:** ${settings.category_id ? `<#${settings.category_id}>` : "not set"}`,
      `**Panel channel:** ${settings.panel_channel_id ? `<#${settings.panel_channel_id}>` : "not set"}`,
      `**Ticket categories:** ${active.length > 0 ? active.map((c) => c.name).join(", ") : "none"}`,
      `**Tickets opened:** ${settings.ticket_counter}`,
      "**Everything else:** the web-admin dashboard under Discord, Tickets. The ticket log is under Discord, Logs.",
    ];
    await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
  },
} satisfies Command;
