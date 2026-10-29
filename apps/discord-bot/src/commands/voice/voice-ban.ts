import { applyTempPermissions } from "../../lib/voice/channel";
import { reasonFor, targetCheck, voiceCommand, voiceCommandData } from "../../lib/voice/command";
import { targetRefusal } from "../../lib/voice/rules";
import { rememberOwnerPrefs, updateTempChannel } from "../../lib/voice/store";

export default voiceCommand({
  data: voiceCommandData("voice-ban", "Ban a user from the temporary voice channel").addUserOption((opt) =>
    opt.setName("member").setDescription("Who to ban").setRequired(true),
  ),
  ownerOnly: true,
  async run(ctx) {
    const user = ctx.interaction.options.getUser("member", true);
    const target = ctx.interaction.options.getMember("member");
    const refusal = targetRefusal("ban", ctx.temp, targetCheck(ctx, user, target));
    if (refusal) return refusal;

    const reason = reasonFor(ctx, "Banned");
    const bannedUserIds = [...ctx.temp.bannedUserIds, user.id];
    await applyTempPermissions(ctx.channel, { ...ctx.temp, bannedUserIds }, { reason });
    await updateTempChannel(ctx.channel.id, { bannedUserIds });
    await rememberOwnerPrefs(ctx.temp, ctx.member.id, { banned_user_ids: bannedUserIds });
    if (target && ctx.channel.members.has(user.id)) await target.voice.disconnect(reason);
    return `Banned ${user}. They can't see or join this channel anymore.`;
  },
});
