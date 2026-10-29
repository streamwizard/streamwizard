import { isOwnerTaken } from "../../lib/voice/actions";
import { applyTempPermissions } from "../../lib/voice/channel";
import { reasonFor, targetCheck, voiceCommand, voiceCommandData } from "../../lib/voice/command";
import { targetRefusal } from "../../lib/voice/rules";
import { updateTempChannel } from "../../lib/voice/store";

export default voiceCommand({
  data: voiceCommandData("voice-transfer", "Transfer ownership of the temporary voice channel").addUserOption((opt) =>
    opt.setName("member").setDescription("The new owner. They need to be in the channel.").setRequired(true),
  ),
  ownerOnly: true,
  async run(ctx) {
    const user = ctx.interaction.options.getUser("member", true);
    const refusal = targetRefusal("transfer", ctx.temp, targetCheck(ctx, user, ctx.interaction.options.getMember("member")));
    if (refusal) return refusal;

    // Database first: its one-channel-per-owner key settles a race with the
    // new owner making a channel of their own.
    const bannedUserIds = ctx.temp.bannedUserIds.filter((id) => id !== user.id);
    try {
      await updateTempChannel(ctx.channel.id, { ownerId: user.id, bannedUserIds });
    } catch (error) {
      if (isOwnerTaken(error)) return `${user} already owns a channel. One channel each.`;
      throw error;
    }
    // The previous owner stays in as a guest when the channel is locked or
    // hidden. That's the actor, unless staff moved someone else's channel.
    await applyTempPermissions(ctx.channel, { ...ctx.temp, ownerId: user.id, bannedUserIds }, {
      add: [ctx.temp.ownerId],
      reason: reasonFor(ctx, "Ownership transferred"),
    });
    return `${user} owns this channel now.`;
  },
});
