import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/discord";

// TODO: replace with the real StreamWizard account-linking URL once the backend flow exists.
const LINK_URL = "https://streamwizard.gg/link/discord";

export default {
  data: new SlashCommandBuilder().setName("link").setDescription("Link your Discord account to StreamWizard"),
  async execute(interaction) {
    const button = new ButtonBuilder().setLabel("Link your account").setStyle(ButtonStyle.Link).setURL(LINK_URL);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      content: "Your Discord account is not connected to StreamWizard yet.",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
