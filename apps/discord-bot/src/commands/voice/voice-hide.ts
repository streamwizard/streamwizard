import { setChannelFlag } from "../../lib/voice/actions";
import { voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-hide", "Hide the temporary voice channel"),
  ownerOnly: true,
  run: (ctx) =>
    setChannelFlag(ctx, "hidden", true, {
      already: "It's already hidden.",
      done: "Hidden. Only the people in it now can see it.",
      reason: "Hidden",
    }),
});
