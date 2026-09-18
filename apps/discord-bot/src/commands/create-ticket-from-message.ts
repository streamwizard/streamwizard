import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from "discord.js";
import type { ContextMenuCommand } from "../types/discord";
import { handleCreate, setPendingOpen } from "../lib/tickets";

const QUOTE_MAX = 1500;

// Right-click a message, get a ticket about it: the form opens with the
// message quoted as the description and the ticket keeps a link to it.
export default {
  data: new ContextMenuCommandBuilder()
    .setName("Create ticket from message")
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.isMessageContextMenuCommand() || !interaction.inCachedGuild()) {
      await interaction.reply({ content: "This only works on a message in the server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const message = interaction.targetMessage;
    const quoted = message.content.trim();
    setPendingOpen(interaction.guildId, interaction.user.id, {
      referencesMessageUrl: message.url,
      description: quoted ? `> ${quoted.slice(0, QUOTE_MAX).replace(/\n/g, "\n> ")}\n\n` : undefined,
    });
    await handleCreate(interaction, null);
  },
} satisfies ContextMenuCommand;
