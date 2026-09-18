import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from "discord.js";
import type { ContextMenuCommand } from "../types/discord";
import { getOpenTicket } from "../lib/ticket-activity";
import { findCategory, getTicketConfig, isStaff } from "../lib/tickets";

// Pin a message in a ticket without Manage Messages: the bot pins it. The
// archive already follows pins through the message update event.
export default {
  data: new ContextMenuCommandBuilder()
    .setName("Pin in ticket")
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.isMessageContextMenuCommand() || !interaction.inCachedGuild()) {
      await interaction.reply({ content: "This only works on a message in the server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const ticket = await getOpenTicket(interaction.guildId, interaction.channelId);
    if (!ticket) {
      await interaction.reply({ content: "This isn't an open ticket channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    const config = await getTicketConfig(interaction.guildId);
    if (!isStaff(interaction.member, config.settings, findCategory(config, ticket.categorySlug))) {
      await interaction.reply({ content: "Only staff can pin messages in a ticket.", flags: MessageFlags.Ephemeral });
      return;
    }
    const message = interaction.targetMessage;
    if (message.pinned) {
      await message.unpin(`Unpinned by ${interaction.user.tag}`);
      await interaction.reply({ content: "Unpinned.", flags: MessageFlags.Ephemeral });
      return;
    }
    await message.pin(`Pinned by ${interaction.user.tag}`);
    await interaction.reply({ content: "Pinned. It's marked in the transcript too.", flags: MessageFlags.Ephemeral });
  },
} satisfies ContextMenuCommand;
