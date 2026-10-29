import { resetChannel } from "../../lib/voice/actions";
import { voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-reset", "Put the channel back to the lobby's defaults and forget your saved settings"),
  ownerOnly: true,
  run: resetChannel,
});
