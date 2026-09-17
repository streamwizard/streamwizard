import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { sendTestWelcome } from "../lib/welcome";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("test-welcome")
    .setDescription("Post a mock welcome message to preview how it looks")
    // Hides the command from members without Manage Server in their client.
    // Only a default (overridable under Server Settings > Integrations), so
    // execute() re-checks the permission.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((opt) => opt.setName("member").setDescription("Member to use in the mock message (defaults to you)").setRequired(false)),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    // Default member permissions are overridable per server; re-check here.
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need Manage Server to use this command.", flags: MessageFlags.Ephemeral });
      return;
    }

    const member = interaction.options.getMember("member") ?? interaction.member;

    const result = await sendTestWelcome(member);
    if (!result.ok) {
      await interaction.reply({
        content: "No usable welcome channel is configured. Run `/setup` to set one, or set a system channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const disabledNote = result.welcomeEnabled ? "" : "\n⚠️ Welcome messages are currently disabled, so this won't fire on real joins.";
    await interaction.reply({
      content: `✅ Sent a mock welcome message in <#${result.channelId}>.${disabledNote}`,
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
