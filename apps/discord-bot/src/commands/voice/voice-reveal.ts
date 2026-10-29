import { setChannelFlag } from "../../lib/voice/actions";
import { voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-reveal", "Reveal the temporary voice channel"),
  ownerOnly: true,
  run: (ctx) =>
    setChannelFlag(ctx, "hidden", false, {
      already: "It isn't hidden.",
      done: "Visible again.",
      reason: "Revealed",
    }),
});
