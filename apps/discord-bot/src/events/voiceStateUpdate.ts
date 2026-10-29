import { Events } from "discord.js";
import { handleVoiceStateUpdate } from "../lib/activity-tracker";
import { handleTempVoiceState } from "../lib/voice/lifecycle";
import type { BotEvent } from "../types/discord";

// Two independent consumers of every voice change: voice time tracking, and
// join-to-create channels. Neither waits for the other, so a slow channel
// create never delays a session, and the move into a new channel reaches the
// tracker as its own voice change.
export default {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    void handleVoiceStateUpdate(oldState, newState);
    void handleTempVoiceState(oldState, newState);
  },
} satisfies BotEvent<typeof Events.VoiceStateUpdate>;
