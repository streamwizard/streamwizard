import { Events } from "discord.js";
import { emitServerEvent } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef, userRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.InviteCreate, async (invite) => {
  if (!invite.guild || !("members" in invite.guild)) return;
  const guild = invite.guild;
  await emitServerEvent(
    guild,
    "invite.created",
    {
      code: invite.code,
      channel: invite.channel && !invite.channel.isDMBased() ? channelRef(invite.channel) : null,
      inviter: userRef(invite.inviter),
      max_uses: invite.maxUses ?? null,
      expires_at: invite.expiresAt?.toISOString() ?? null,
      temporary: invite.temporary ?? false,
    },
    { actorDiscordId: invite.inviterId },
  );
});
