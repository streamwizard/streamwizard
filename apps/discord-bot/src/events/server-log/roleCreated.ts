import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { roleRef } from "../../lib/server-log/refs";

export default {
  name: Events.GuildRoleCreate,
  async execute(role) {
    if (role.managed) return;
    await emitAuditedEvent(
      role.guild,
      "role.created",
      { type: AuditLogEvent.RoleCreate, targetId: role.id },
      { role: roleRef(role), permissions: role.permissions.toArray() },
    );
  },
} satisfies BotEvent<typeof Events.GuildRoleCreate>;
