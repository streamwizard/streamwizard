import { Events } from "discord.js";
import { emitServerEvent } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { memberRef } from "../../lib/server-log/refs";

export default serverLogEvent(Events.GuildMemberAdd, async (member) => {
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
});
