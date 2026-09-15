import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef } from "../../lib/server-log/refs";
import { isOpenTicketChannel } from "../../lib/ticket-activity";

// Closed tickets delete their channel; the ticket log already covers that.
export default serverLogEvent(Events.ChannelDelete, async (channel) => {
  if (channel.isDMBased()) return;
  if (!(await isServerEventEnabled(channel.guild, "channel.deleted"))) return;
  if (await isOpenTicketChannel(channel.guild.id, channel.id).catch(() => false)) return;
  const audit = await findAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, { targetId: channel.id });
  if (audit?.bySelf) return;
  await emitServerEvent(
    channel.guild,
    "channel.deleted",
    { channel: channelRef(channel)!, moderator: audit?.moderator ?? null, reason: audit?.reason ?? null },
    { actorDiscordId: audit?.moderator?.id },
  );
});
