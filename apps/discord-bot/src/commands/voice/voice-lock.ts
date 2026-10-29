import { setChannelFlag } from "../../lib/voice/actions";
import { voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-lock", "Lock the temporary voice channel"),
  ownerOnly: true,
  run: (ctx) =>
    setChannelFlag(ctx, "locked", true, {
      already: "It's already locked.",
      done: "Locked. Nobody new gets in, and everyone here now can still come back.",
      reason: "Locked",
    }),
});
