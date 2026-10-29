import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { VOICE_RENAME_BLOCK_REASON_MAX } from "@repo/supabase/queries/discord-voice";
import type { Command } from "../../types/discord";
import { isServerVoiceStaff, resetOwnedChannelName } from "../../lib/voice/rename-block";
import { renameBlockRefusal } from "../../lib/voice/rules";
import { addRenameBlock, isRenameBlocked } from "../../lib/voice/store";

export default {
  data: new SlashCommandBuilder()
    .setName("voice-rename-block")
    .setDescription("Stop a member from renaming voice channels, and put their channel's name back")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((opt) => opt.setName("member").setDescription("Who to block").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Why, for the other staff").setMaxLength(VOICE_RENAME_BLOCK_REASON_MAX),
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This only works in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!(await isServerVoiceStaff(interaction.member))) {
      await interaction.reply({ content: "Only voice staff can block renames.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser("member", true);
    const target = interaction.options.getMember("member");
    if (!target) {
      await interaction.editReply(`${user} isn't in this server.`);
      return;
    }
    const refusal = renameBlockRefusal({
      actorId: interaction.user.id,
      targetId: user.id,
      targetIsBot: user.bot,
      targetIsStaff: await isServerVoiceStaff(target),
      alreadyBlocked: await isRenameBlocked(interaction.guildId, user.id),
    });
    if (refusal) {
      await interaction.editReply({ content: refusal, allowedMentions: { parse: [] } });
      return;
    }

    await addRenameBlock({
      guild_id: interaction.guildId,
      discord_user_id: user.id,
      username: user.username,
      blocked_by_discord_user_id: interaction.user.id,
      blocked_by_username: interaction.user.username,
      reason: interaction.options.getString("reason"),
    });
    const renamed = await resetOwnedChannelName(target, `Rename blocked by ${interaction.user.tag} (/voice-rename-block)`);
    await interaction.editReply({
      content: [`Blocked ${user} from renaming voice channels. Their channels use the lobby's name until /voice-rename-unblock.`, renamed]
        .filter(Boolean)
        .join(" "),
      allowedMentions: { parse: [] },
    });
  },
} satisfies Command;
