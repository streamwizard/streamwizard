import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { roleRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.GuildRoleCreate, async (role) => {
  if (role.managed || !(await isServerEventEnabled(role.guild, "role.created"))) return;
  const audit = await findAuditEntry(role.guild, AuditLogEvent.RoleCreate, { targetId: role.id });
  await emitServerEvent(
    role.guild,
    "role.created",
    {
      role: roleRef(role),
      permissions: role.permissions.toArray(),
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? null,
    },
    { actorDiscordId: audit?.moderator?.id },
  );
});
