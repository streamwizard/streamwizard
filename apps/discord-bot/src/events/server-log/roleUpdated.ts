import { AuditLogEvent, Events, type Role } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { diffFields, diffPermissions, hexColor, roleRef } from "../../lib/server-log/refs";

const snapshot = (role: Role) => ({
  name: role.name,
  color: hexColor(role.color),
  hoist: role.hoist,
  mentionable: role.mentionable,
  icon: role.icon ?? role.unicodeEmoji ?? null,
});

// Position changes (dragging roles around) touch every role in between; they
// aren't logged.
export default serverLogEvent(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  const changes = diffFields(snapshot(oldRole), snapshot(newRole));
  const permissions = diffPermissions(oldRole.permissions.bitfield, newRole.permissions.bitfield);
  if (!Object.keys(changes).length && !permissions.added.length && !permissions.removed.length) return;
  if (!(await isServerEventEnabled(newRole.guild, "role.updated"))) return;

  const audit = await findAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate, { targetId: newRole.id });
  await emitServerEvent(
    newRole.guild,
    "role.updated",
    {
      role: roleRef(newRole),
      changes,
      permissions_added: permissions.added,
      permissions_removed: permissions.removed,
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? null,
    },
    { actorDiscordId: audit?.moderator?.id },
  );
});
