import { AuditLogEvent, Events, type Role } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
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
export default {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    const changes = diffFields(snapshot(oldRole), snapshot(newRole));
    const permissions = diffPermissions(oldRole.permissions.bitfield, newRole.permissions.bitfield);
    if (!Object.keys(changes).length && !permissions.added.length && !permissions.removed.length) return;

    await emitAuditedEvent(
      newRole.guild,
      "role.updated",
      { type: AuditLogEvent.RoleUpdate, targetId: newRole.id },
      {
        role: roleRef(newRole),
        changes,
        permissions_added: permissions.added,
        permissions_removed: permissions.removed,
      },
    );
  },
} satisfies BotEvent<typeof Events.GuildRoleUpdate>;
