import { Events } from "discord.js";
import { emitServerEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { channelRef } from "../../lib/server-log/refs";

export default {
  name: Events.InviteDelete,
  async execute(invite) {
    if (!invite.guild || !("members" in invite.guild)) return;
    await emitServerEvent(invite.guild, "invite.deleted", {
      code: invite.code,
      channel: invite.channel && !invite.channel.isDMBased() ? channelRef(invite.channel) : null,
    });
  },
} satisfies BotEvent<typeof Events.InviteDelete>;
