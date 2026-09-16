import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { userRef } from "../../lib/server-log/refs";

export default {
  name: Events.GuildBanAdd,
  async execute(ban) {
    await emitAuditedEvent(
      ban.guild,
      "member.banned",
      { type: AuditLogEvent.MemberBanAdd, targetId: ban.user.id },
      { member: userRef(ban.user) ?? { id: ban.user.id } },
      { subjectDiscordId: ban.user.id, fallbackReason: ban.reason },
    );
  },
} satisfies BotEvent<typeof Events.GuildBanAdd>;
