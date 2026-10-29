import { setChannelFlag } from "../../lib/voice/actions";
import { voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-unlock", "Unlock the temporary voice channel"),
  ownerOnly: true,
  run: (ctx) =>
    setChannelFlag(ctx, "locked", false, {
      already: "It isn't locked.",
      done: "Unlocked. Anyone who can see it can join.",
      reason: "Unlocked",
    }),
});
