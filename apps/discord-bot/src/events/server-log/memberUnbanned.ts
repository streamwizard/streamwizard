import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { userRef } from "../../lib/server-log/refs";

export default {
  name: Events.GuildBanRemove,
  async execute(ban) {
    await emitAuditedEvent(
      ban.guild,
      "member.unbanned",
      { type: AuditLogEvent.MemberBanRemove, targetId: ban.user.id },
      { member: userRef(ban.user) ?? { id: ban.user.id } },
      { subjectDiscordId: ban.user.id },
    );
  },
} satisfies BotEvent<typeof Events.GuildBanRemove>;
