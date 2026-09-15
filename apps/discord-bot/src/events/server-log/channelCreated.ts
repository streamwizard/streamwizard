import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef } from "../../lib/server-log/refs";
import { isSelfAction } from "../../lib/server-log/self-actions";

// Ticket channels are the bot's own; ticket.opened covers them.
export default serverLogEvent(Events.ChannelCreate, async (channel) => {
  if (isSelfAction("channel", channel.id)) return;
  if (!(await isServerEventEnabled(channel.guild, "channel.created"))) return;
  const audit = await findAuditEntry(channel.guild, AuditLogEvent.ChannelCreate, { targetId: channel.id });
  if (audit?.bySelf) return;
  await emitServerEvent(
    channel.guild,
    "channel.created",
    { channel: channelRef(channel)!, moderator: audit?.moderator ?? null, reason: audit?.reason ?? null },
    { actorDiscordId: audit?.moderator?.id },
  );
});
