import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/discord";
import { cleanTempChannels } from "../../lib/voice/lifecycle";
import { cleanSummary } from "../../lib/voice/rules";

export default {
  data: new SlashCommandBuilder()
    .setName("voice-clean")
    .setDescription("Delete all the inactive temporary channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    // The default member permission is only a default: re-check, so a server
    // that opened the command up still keeps it to staff.
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: "Only staff with Manage Channels can clean up voice channels.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(cleanSummary(await cleanTempChannels(interaction.guild)));
  },
} satisfies Command;
