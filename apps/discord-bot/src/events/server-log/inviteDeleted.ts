import { Events } from "discord.js";
import { emitServerEvent } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.InviteDelete, async (invite) => {
  if (!invite.guild || !("members" in invite.guild)) return;
  await emitServerEvent(invite.guild, "invite.deleted", {
    code: invite.code,
    channel: invite.channel && !invite.channel.isDMBased() ? channelRef(invite.channel) : null,
  });
});
