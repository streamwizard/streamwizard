import { Events } from "discord.js";
import { forgetRenameHistory } from "../lib/voice/rename";
import { forgetTempChannels, getTempChannel } from "../lib/voice/store";
import type { BotEvent } from "../types/discord";

// A temp channel deleted by hand (its owner has Manage Channels on it, and
// staff can always) never empties through a voice change, so its row would
// outlive it until the next restart.
export default {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (channel.isDMBased() || !getTempChannel(channel.id)) return;
    await forgetTempChannels([channel.id]);
    forgetRenameHistory(channel.id);
  },
} satisfies BotEvent<typeof Events.ChannelDelete>;
