import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { userRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.GuildBanRemove, async (ban) => {
  if (!(await isServerEventEnabled(ban.guild, "member.unbanned"))) return;
  const audit = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, { targetId: ban.user.id });
  await emitServerEvent(
    ban.guild,
    "member.unbanned",
    {
      member: userRef(ban.user) ?? { id: ban.user.id },
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? null,
    },
    { subjectDiscordId: ban.user.id, actorDiscordId: audit?.moderator?.id },
  );
});
