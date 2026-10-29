import { applyTempPermissions } from "../../lib/voice/channel";
import { reasonFor, targetCheck, voiceCommand, voiceCommandData } from "../../lib/voice/command";
import { targetRefusal } from "../../lib/voice/rules";
import { rememberOwnerPrefs, updateTempChannel } from "../../lib/voice/store";

export default voiceCommand({
  data: voiceCommandData("voice-unban", "Unban a user from the temporary voice channel").addUserOption((opt) =>
    opt.setName("member").setDescription("Who to unban").setRequired(true),
  ),
  ownerOnly: true,
  async run(ctx) {
    const user = ctx.interaction.options.getUser("member", true);
    const refusal = targetRefusal("unban", ctx.temp, targetCheck(ctx, user, ctx.interaction.options.getMember("member")));
    if (refusal) return refusal;

    const bannedUserIds = ctx.temp.bannedUserIds.filter((id) => id !== user.id);
    await applyTempPermissions(ctx.channel, { ...ctx.temp, bannedUserIds }, { reason: reasonFor(ctx, "Unbanned") });
    await updateTempChannel(ctx.channel.id, { bannedUserIds });
    await rememberOwnerPrefs(ctx.temp, ctx.member.id, { banned_user_ids: bannedUserIds });
    return ctx.temp.locked ? `Unbanned ${user}. The channel is still locked, though.` : `Unbanned ${user}. They can join again.`;
  },
});
