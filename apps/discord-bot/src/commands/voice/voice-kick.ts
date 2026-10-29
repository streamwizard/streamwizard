import { applyTempPermissions } from "../../lib/voice/channel";
import { reasonFor, targetCheck, voiceCommand, voiceCommandData } from "../../lib/voice/command";
import { targetRefusal } from "../../lib/voice/rules";

export default voiceCommand({
  data: voiceCommandData("voice-kick", "Kick a user from the temporary voice channel").addUserOption((opt) =>
    opt.setName("member").setDescription("Who to kick").setRequired(true),
  ),
  ownerOnly: true,
  async run(ctx) {
    const user = ctx.interaction.options.getUser("member", true);
    const target = ctx.interaction.options.getMember("member");
    const refusal = targetRefusal("kick", ctx.temp, targetCheck(ctx, user, target));
    if (refusal || !target) return refusal ?? `${user} isn't in this channel.`;

    const reason = reasonFor(ctx, "Kicked");
    // A kicked guest loses their way back past a lock or hide too.
    if (ctx.temp.locked || ctx.temp.hidden) await applyTempPermissions(ctx.channel, ctx.temp, { drop: [user.id], reason });
    await target.voice.disconnect(reason);
    return `Kicked ${user}. They can come back unless it's locked. /voice-ban keeps them out.`;
  },
});
