import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { roleRef } from "../../lib/server-log/refs";

export default {
  name: Events.GuildRoleDelete,
  async execute(role) {
    await emitAuditedEvent(
      role.guild,
      "role.deleted",
      { type: AuditLogEvent.RoleDelete, targetId: role.id },
      { role: roleRef(role) },
    );
  },
} satisfies BotEvent<typeof Events.GuildRoleDelete>;
