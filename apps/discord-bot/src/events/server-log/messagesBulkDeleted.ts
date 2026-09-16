import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent, isLoggedChannel } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { truncate } from "../../lib/log-channel/embed-kit";
import { channelRef, displayNameOf } from "../../lib/server-log/refs";

const MAX_LINES = 20;
const MAX_LINE = 180;

// Welcome cleanup and panel reposts are the bot's own bulk deletes; the audit
// match skips those.
export default {
  name: Events.MessageBulkDelete,
  async execute(messages, channel) {
    await emitAuditedEvent(
      channel.guild,
      "message.bulk_deleted",
      { type: AuditLogEvent.MessageBulkDelete, targetId: channel.id },
      async () => {
        if (!(await isLoggedChannel(channel.guild, channel.id, channel.parentId))) return null;
        const lines = [...messages.values()]
          .filter((message) => !message.partial && !message.author.bot)
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .slice(-MAX_LINES)
          .map((message) => {
            const name = (message.author && displayNameOf(message.author, message.member)) ?? "Unknown";
            return `${name}: ${truncate((message.content ?? "").replace(/\s+/g, " "), MAX_LINE)}`;
          });
        return { channel: channelRef(channel, channel.id)!, count: messages.size, lines };
      },
    );
  },
} satisfies BotEvent<typeof Events.MessageBulkDelete>;
