import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent, shouldLogMessage } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { channelRef, messageText, userRef } from "../../lib/server-log/refs";
import { archiveMessageDeletes } from "../../lib/tickets/archive";

// Deletes of uncached messages arrive with only the ids, so author and text are
// unknown. Discord only writes an audit entry when someone deletes another
// person's message, so a match means a moderator did it.
export default {
  name: Events.MessageDelete,
  async execute(message) {
    const guild = message.guildId ? message.client.guilds.cache.get(message.guildId) : null;
    if (!guild) return;
    void archiveMessageDeletes(guild.id, message.channelId, [message.id]);
    const author = message.partial ? null : message.author;

    await emitAuditedEvent(
      guild,
      "message.deleted",
      author ? { type: AuditLogEvent.MessageDelete, targetId: author.id, channelId: message.channelId } : null,
      async () => {
        if (!(await shouldLogMessage(guild, message))) return null;
        return {
          member: author ? userRef(author, message.member) : null,
          channel: channelRef(guild.channels.cache.get(message.channelId), message.channelId)!,
          message_id: message.id,
          content: message.partial ? null : messageText(message.content),
          attachments: message.partial ? [] : message.attachments.map((attachment) => attachment.name),
          sent_at: message.createdAt?.toISOString() ?? null,
        };
      },
      { subjectDiscordId: author?.id },
    );
  },
} satisfies BotEvent<typeof Events.MessageDelete>;
