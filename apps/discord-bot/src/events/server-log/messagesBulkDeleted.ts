import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef } from "../../lib/server-log/refs";
import { getLogChannelIds } from "../../lib/log-channel/worker";

const MAX_LINES = 20;
const MAX_LINE = 180;

export default serverLogEvent(Events.MessageBulkDelete, async (messages, channel) => {
  const guild = channel.guild;
  if (!(await isServerEventEnabled(guild, "message.bulk_deleted"))) return;
  if ((await getLogChannelIds(guild.client, guild.id)).has(channel.id)) return;

  const lines = [...messages.values()]
    .filter((message) => !message.partial && !message.author.bot)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .slice(-MAX_LINES)
    .map((message) => {
      const name = message.member?.displayName ?? message.author?.username ?? "Unknown";
      const text = (message.content ?? "").replace(/\s+/g, " ");
      return `${name}: ${text.length > MAX_LINE ? `${text.slice(0, MAX_LINE - 1)}…` : text}`;
    });
  const audit = await findAuditEntry(guild, AuditLogEvent.MessageBulkDelete, { targetId: channel.id });
  // Welcome cleanup and panel reposts are the bot's own bulk deletes.
  if (audit?.bySelf) return;

  await emitServerEvent(
    guild,
    "message.bulk_deleted",
    {
      channel: channelRef(channel, channel.id)!,
      count: messages.size,
      lines,
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? null,
    },
    { actorDiscordId: audit?.moderator?.id },
  );
});
