import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import type { Command } from "../types/discord";
import { buildLinkRow } from "../lib/account";

export default {
  data: new SlashCommandBuilder().setName("link").setDescription("Link your Discord account to StreamWizard"),
  async execute(interaction) {
    const { data: existing } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);

    if (existing) {
      await interaction.reply({
        content: `Already linked as **${existing.discord_username}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: "Your Discord account is not connected to StreamWizard yet.",
      components: [buildLinkRow()],
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
