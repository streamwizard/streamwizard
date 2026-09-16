import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { channelRef } from "../../lib/server-log/refs";
import { isSelfAction } from "../../lib/server-log/self-actions";

// Ticket channels are the bot's own; ticket.opened covers them.
export default {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (isSelfAction("channel", channel.id)) return;
    await emitAuditedEvent(
      channel.guild,
      "channel.created",
      { type: AuditLogEvent.ChannelCreate, targetId: channel.id },
      { channel: channelRef(channel)! },
    );
  },
} satisfies BotEvent<typeof Events.ChannelCreate>;
