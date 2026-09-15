import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { roleRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.GuildRoleDelete, async (role) => {
  if (!(await isServerEventEnabled(role.guild, "role.deleted"))) return;
  const audit = await findAuditEntry(role.guild, AuditLogEvent.RoleDelete, { targetId: role.id });
  await emitServerEvent(
    role.guild,
    "role.deleted",
    { role: roleRef(role), moderator: audit?.moderator ?? null, reason: audit?.reason ?? null },
    { actorDiscordId: audit?.moderator?.id },
  );
});
