import { escapeMarkdown, time, TimestampStyles } from "discord.js";
import { isVoiceStaff, reasonFor, voiceCommand, voiceCommandData } from "../../lib/voice/command";
import { renameTempChannel } from "../../lib/voice/rename";
import { isRenameBlocked, rememberOwnerPrefs } from "../../lib/voice/store";
import { CHANNEL_NAME_MAX, cleanChannelName } from "../../lib/voice/template";

export default voiceCommand({
  data: voiceCommandData("voice-rename", "Rename the temporary voice channel").addStringOption((opt) =>
    opt.setName("name").setDescription("The new name").setMaxLength(CHANNEL_NAME_MAX).setRequired(true),
  ),
  ownerOnly: true,
  async run(ctx) {
    const name = cleanChannelName(ctx.interaction.options.getString("name", true));
    if (!name) return "That name is empty. Try another one.";
    if (name === ctx.channel.name) return "That's already its name.";
    if (!isVoiceStaff(ctx.member, ctx.staffRoleIds) && (await isRenameBlocked(ctx.channel.guild.id, ctx.member.id))) {
      return "Voice staff blocked you from renaming voice channels. Your channels use the lobby's name for now.";
    }

    const result = await renameTempChannel(ctx.channel, name, reasonFor(ctx, "Renamed"));
    if (result.ok) {
      await rememberOwnerPrefs(ctx.temp, ctx.member.id, { name });
      return `Renamed to **${escapeMarkdown(name)}**.`;
    }
    return `Discord allows 2 renames per channel every 10 minutes. Try again ${time(Math.ceil(result.retryAt / 1000), TimestampStyles.RelativeTime)}.`;
  },
});
