import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { userRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.GuildBanAdd, async (ban) => {
  if (!(await isServerEventEnabled(ban.guild, "member.banned"))) return;
  const audit = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, { targetId: ban.user.id });
  await emitServerEvent(
    ban.guild,
    "member.banned",
    {
      member: userRef(ban.user) ?? { id: ban.user.id },
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? ban.reason ?? null,
    },
    { subjectDiscordId: ban.user.id, actorDiscordId: audit?.moderator?.id },
  );
});
