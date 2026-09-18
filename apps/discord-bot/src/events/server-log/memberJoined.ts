import { Events } from "discord.js";
import { emitServerEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { memberRef } from "../../lib/server-log/refs";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    await emitServerEvent(
      member.guild,
      "member.joined",
      {
        member: memberRef(member),
        account_created_at: member.user.createdAt.toISOString(),
        member_count: member.guild.memberCount,
      },
      { subjectDiscordId: member.id },
    );
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>;
