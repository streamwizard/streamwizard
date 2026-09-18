import { MessageFlags, type ButtonInteraction } from "discord.js";
import { isButtonActionKey, parseButtonCustomId, type ButtonActionKey } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import { buildLinkRow } from "./account";
import { handleCreateButton } from "./tickets/open";

// Action buttons on messages from web-admin's message builder. The builder
// only offers the actions in @repo/discord-message's BUTTON_ACTIONS, and the
// record below must answer every one of them, so a new action doesn't compile
// until it has a handler. Dispatched by customId alone: the buttons keep
// working after a restart. Every answer is ephemeral, the message in the
// channel is for everyone and stays as it is.

type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

const HANDLERS: Record<ButtonActionKey, ButtonHandler> = {
  // Same answers as /link.
  async link_account(interaction) {
    const { data: existing, error } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);
    if (error) throw error;

    if (existing) {
      await interaction.reply({
        content: `You're already linked as **${existing.discord_username}**. Nothing left to do.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: "Your Discord account isn't connected to StreamWizard yet. Use the button below to link it.",
      components: [buildLinkRow()],
      flags: MessageFlags.Ephemeral,
    });
  },

  // Same flow as the ticket panel's Create Ticket button.
  async create_ticket(interaction) {
    await handleCreateButton(interaction, null);
  },
};

export const isBuiltButton = (customId: string): boolean => parseButtonCustomId(customId) !== null;

export async function handleBuiltButton(interaction: ButtonInteraction): Promise<void> {
  const action = parseButtonCustomId(interaction.customId)?.action ?? "";
  try {
    if (!isButtonActionKey(action)) {
      // A message published by a newer or older build than this one.
      await interaction.reply({ content: "This button doesn't do anything anymore.", flags: MessageFlags.Ephemeral });
      return;
    }
    await HANDLERS[action](interaction);
  } catch (error) {
    reportError(error, "discord-bot built-button", { action, guildId: interaction.guildId });
    const payload = { content: "Something went wrong. Try again in a moment.", flags: MessageFlags.Ephemeral } as const;
    await (interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload)).catch(() => {});
  }
}
