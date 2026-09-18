import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from "discord.js";
import type { ContextMenuCommand } from "../types/discord";
import { getTicketConfig, handleCreate, isStaff, setPendingOpen } from "../lib/tickets";

// Staff right-click a member and open a ticket that is theirs: they become
// the opener (the channel, the limits and the closing DM are all about them),
// and the timeline records who opened it for them.
export default {
  data: new ContextMenuCommandBuilder()
    .setName("Create ticket for user")
    .setType(ApplicationCommandType.User)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.isUserContextMenuCommand() || !interaction.inCachedGuild()) {
      await interaction.reply({ content: "This only works on a member of the server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const config = await getTicketConfig(interaction.guildId);
    if (!isStaff(interaction.member, config.settings)) {
      await interaction.reply({ content: "Only staff can open a ticket for someone else.", flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.targetMember;
    if (!target || target.user.bot) {
      await interaction.reply({ content: "Pick a member of the server, not a bot.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "That's you. Use the ticket panel for your own ticket.", flags: MessageFlags.Ephemeral });
      return;
    }
    setPendingOpen(interaction.guildId, interaction.user.id, { onBehalfOfId: target.id });
    await handleCreate(interaction, null);
  },
} satisfies ContextMenuCommand;
