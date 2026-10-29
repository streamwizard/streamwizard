import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/discord";
import { asTempVoiceChannel, refreshVoicePanel } from "../../lib/voice/channel";
import { serialized } from "../../lib/voice/command";
import { isServerVoiceStaff } from "../../lib/voice/rename-block";
import { ensureLoaded, findOwnedChannel, removeRenameBlock } from "../../lib/voice/store";

export default {
  data: new SlashCommandBuilder()
    .setName("voice-rename-unblock")
    .setDescription("Let a member rename voice channels again")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((opt) => opt.setName("member").setDescription("Who to unblock").setRequired(true)),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!(await isServerVoiceStaff(interaction.member))) {
      await interaction.reply({ content: "Only voice staff can lift rename blocks.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser("member", true);
    if (!(await removeRenameBlock(interaction.guildId, user.id))) {
      await interaction.editReply({ content: `${user} isn't blocked from renaming.`, allowedMentions: { parse: [] } });
      return;
    }

    await ensureLoaded();
    const owned = findOwnedChannel(interaction.guildId, user.id);
    const channel = asTempVoiceChannel(owned ? interaction.guild.channels.cache.get(owned.channelId) : null);
    if (channel) await serialized(channel.id, () => refreshVoicePanel(channel));
    await interaction.editReply({ content: `${user} can rename voice channels again.`, allowedMentions: { parse: [] } });
  },
} satisfies Command;
