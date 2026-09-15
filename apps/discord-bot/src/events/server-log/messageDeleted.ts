import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled, shouldLogMessage } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef, messageText, userRef } from "../../lib/server-log/refs";

// Deletes of uncached messages arrive with only the ids, so author and text are
// unknown. Discord only writes an audit entry when someone deletes another
// person's message, so a match means a moderator did it.
export default serverLogEvent(Events.MessageDelete, async (message) => {
  const guild = message.guildId ? message.client.guilds.cache.get(message.guildId) : null;
  if (!guild) return;
  if (!(await isServerEventEnabled(guild, "message.deleted"))) return;
  if (!(await shouldLogMessage(guild, message))) return;

  const author = message.partial ? null : message.author;
  const audit = author
    ? await findAuditEntry(guild, AuditLogEvent.MessageDelete, { targetId: author.id, channelId: message.channelId })
    : null;
  if (audit?.bySelf) return;
  const channel = guild.channels.cache.get(message.channelId);

  await emitServerEvent(
    guild,
    "message.deleted",
    {
      member: author ? userRef(author, message.member) : null,
      channel: channelRef(channel, message.channelId)!,
      message_id: message.id,
      content: message.partial ? null : messageText(message.content),
      attachments: message.partial ? [] : message.attachments.map((attachment) => attachment.name),
      sent_at: message.createdAt?.toISOString() ?? null,
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? null,
    },
    { subjectDiscordId: author?.id, actorDiscordId: audit?.moderator?.id },
  );
});
