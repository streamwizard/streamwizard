import { voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-owner", "Check ownership of the temporary voice channel"),
  ownerOnly: false,
  async run({ member, temp, ownerPresent }) {
    if (temp.ownerId === member.id) return "You own this channel.";
    if (ownerPresent) return `<@${temp.ownerId}> owns this channel.`;
    return `<@${temp.ownerId}> owns this channel, but they left. /voice-claim makes it yours.`;
  },
});
