import { AuditLogEvent, Events } from "discord.js";
import { reportError } from "@repo/sentry";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { channelRef } from "../../lib/server-log/refs";
import { isOpenTicketChannel } from "../../lib/ticket-activity";
import { closeOrphanedTicket } from "../../lib/tickets";

// Closed tickets delete their channel; the ticket log already covers that.
export default {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (channel.isDMBased()) return;

    // A ticket channel deleted by hand never went through the close flow, so
    // its row would stay open forever. Close it, then let the deletion reach
    // the server log like any other: that entry names who deleted it.
    await closeOrphanedTicket(channel.guild, channel.id).catch((error) =>
      reportError(error, "discord-bot tickets: close orphaned", { channelId: channel.id }),
    );

    await emitAuditedEvent(
      channel.guild,
      "channel.deleted",
      { type: AuditLogEvent.ChannelDelete, targetId: channel.id },
      async () => {
        if (await isOpenTicketChannel(channel.guild.id, channel.id).catch(() => false)) return null;
        return { channel: channelRef(channel)! };
      },
    );
  },
} satisfies BotEvent<typeof Events.ChannelDelete>;
