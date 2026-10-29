import { isOwnerTaken } from "../../lib/voice/actions";
import { applyTempPermissions } from "../../lib/voice/channel";
import { reasonFor, voiceCommand, voiceCommandData } from "../../lib/voice/command";
import { claimRefusal } from "../../lib/voice/rules";
import { findOwnedChannel, updateTempChannel } from "../../lib/voice/store";

export default voiceCommand({
  data: voiceCommandData("voice-claim", "Claim ownership of the temporary voice channel"),
  ownerOnly: false,
  async run(ctx) {
    const { member, channel, temp } = ctx;
    const owned = findOwnedChannel(channel.guild.id, member.id);
    const refusal = claimRefusal({
      claimerId: member.id,
      ownerId: temp.ownerId,
      claimerInChannel: channel.members.has(member.id),
      ownerPresent: ctx.ownerPresent,
      claimerOwnsOther: owned && owned.channelId !== channel.id ? owned.channelId : null,
    });
    if (refusal) return refusal;

    const bannedUserIds = temp.bannedUserIds.filter((id) => id !== member.id);
    try {
      await updateTempChannel(channel.id, { ownerId: member.id, bannedUserIds });
    } catch (error) {
      if (isOwnerTaken(error)) return "You already own a channel. One channel each.";
      throw error;
    }
    await applyTempPermissions(channel, { ...temp, ownerId: member.id, bannedUserIds }, { reason: reasonFor(ctx, "Claimed") });
    return "Claimed. It's your channel now.";
  },
});
