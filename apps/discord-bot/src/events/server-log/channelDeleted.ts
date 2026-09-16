import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { channelRef } from "../../lib/server-log/refs";
import { isOpenTicketChannel } from "../../lib/ticket-activity";

// Closed tickets delete their channel; the ticket log already covers that.
export default {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (channel.isDMBased()) return;
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
