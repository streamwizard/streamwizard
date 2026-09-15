import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { memberRef, roleRef } from "../../lib/server-log/refs";

// A leave, a kick or a ban all arrive as GuildMemberRemove. The audit log
// tells them apart; bans are logged by guildBanAdd, so they're skipped here.
export default serverLogEvent(Events.GuildMemberRemove, async (member) => {
  const guild = member.guild;
  const [logKicks, logLeaves] = await Promise.all([
    isServerEventEnabled(guild, "member.kicked"),
    isServerEventEnabled(guild, "member.left"),
  ]);
  if (!logKicks && !logLeaves) return;

  const [kick, ban] = await Promise.all([
    findAuditEntry(guild, AuditLogEvent.MemberKick, { targetId: member.id }),
    findAuditEntry(guild, AuditLogEvent.MemberBanAdd, { targetId: member.id }),
  ]);
  if (ban) return;

  const roles = member.partial
    ? undefined
    : member.roles.cache.filter((role) => role.id !== guild.id).map((role) => roleRef(role));
  const joinedAt = member.joinedAt?.toISOString() ?? null;

  if (kick) {
    await emitServerEvent(
      guild,
      "member.kicked",
      { member: memberRef(member), joined_at: joinedAt, roles, moderator: kick.moderator, reason: kick.reason },
      { subjectDiscordId: member.id, actorDiscordId: kick.moderator?.id },
    );
    return;
  }

  await emitServerEvent(
    guild,
    "member.left",
    { member: memberRef(member), joined_at: joinedAt, roles, member_count: guild.memberCount },
    { subjectDiscordId: member.id },
  );
});
