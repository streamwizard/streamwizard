import { Events } from "discord.js";
import { recordMessage } from "../lib/activity-tracker";
import { notifyTicketActivity } from "../lib/ticket-activity";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.MessageCreate,
  execute(message) {
    void recordMessage(message);
    if (message.guildId) void notifyTicketActivity(message.guildId, message.channelId, "message");
  },
} satisfies BotEvent<typeof Events.MessageCreate>;
