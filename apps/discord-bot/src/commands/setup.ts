import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { startSetupWizard } from "../lib/setup-wizard";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure StreamWizard for this server")
    // Hides the command from members without Manage Server in their client.
    // Only a default: admins can open it to anyone under Server Settings >
    // Integrations, so execute() re-checks the permission.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need Manage Server to run setup.", flags: MessageFlags.Ephemeral });
      return;
    }

    await startSetupWizard(interaction);
  },
} satisfies Command;
