import { isOwnerTaken } from "../../lib/voice/actions";
import { applyTempPermissions } from "../../lib/voice/channel";
import { isVoiceStaff, reasonFor, voiceCommand, voiceCommandData } from "../../lib/voice/command";
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
      claimerIsStaff: isVoiceStaff(member, ctx.staffRoleIds),
    });
    if (refusal) return refusal;

    const bannedUserIds = temp.bannedUserIds.filter((id) => id !== member.id);
    try {
      await updateTempChannel(channel.id, { ownerId: member.id, bannedUserIds });
    } catch (error) {
      if (isOwnerTaken(error)) return "You already own a channel. One channel each.";
      throw error;
    }
    // A staff takeover with the owner still here: they stay in as a guest, so
    // a lock or hide doesn't shut them out of the channel they made.
    await applyTempPermissions(
      channel,
      { ...temp, ownerId: member.id, bannedUserIds },
      { add: ctx.ownerPresent ? [temp.ownerId] : [], reason: reasonFor(ctx, ctx.ownerPresent ? "Taken over by staff" : "Claimed") },
    );
    return ctx.ownerPresent ? `Taken over from <@${temp.ownerId}>. It's your channel now.` : "Claimed. It's your channel now.";
  },
});
