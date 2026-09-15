import { AuditLogEvent, Events } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { diffRoleIds, memberRef, roleRef } from "../../lib/server-log/refs";
import { isSelfAction } from "../../lib/server-log/self-actions";

// Timeouts, nickname and role changes all arrive as GuildMemberUpdate. When the
// old member wasn't cached there's nothing to compare with, so nothing is logged.
// (Membership screening is handled by src/events/guildMemberUpdate.ts.)
export default serverLogEvent(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (oldMember.partial) return;
  const guild = newMember.guild;
  const subject = { subjectDiscordId: newMember.id };

  const oldUntil = oldMember.communicationDisabledUntilTimestamp ?? 0;
  const newUntil = newMember.communicationDisabledUntilTimestamp ?? 0;
  const timedOut = newUntil > Date.now() && newUntil !== oldUntil;
  const timeoutRemoved = oldUntil > Date.now() && newUntil <= Date.now();
  if (timedOut || timeoutRemoved) {
    const type = timedOut ? "member.timed_out" : "member.timeout_removed";
    if (await isServerEventEnabled(guild, type)) {
      const audit = await findAuditEntry(guild, AuditLogEvent.MemberUpdate, {
        targetId: newMember.id,
        where: (entry) => entry.changes.some((change) => change.key === "communication_disabled_until"),
      });
      const moderation = {
        member: memberRef(newMember),
        moderator: audit?.moderator ?? null,
        reason: audit?.reason ?? null,
      };
      const options = { ...subject, actorDiscordId: audit?.moderator?.id };
      if (timedOut) {
        await emitServerEvent(
          guild,
          "member.timed_out",
          { ...moderation, until: new Date(newUntil).toISOString() },
          options,
        );
      } else {
        await emitServerEvent(guild, "member.timeout_removed", moderation, options);
      }
    }
  }

  if (oldMember.nickname !== newMember.nickname && (await isServerEventEnabled(guild, "member.nickname_changed"))) {
    const audit = await findAuditEntry(guild, AuditLogEvent.MemberUpdate, {
      targetId: newMember.id,
      where: (entry) => entry.changes.some((change) => change.key === "nick"),
    });
    await emitServerEvent(
      guild,
      "member.nickname_changed",
      {
        member: memberRef(newMember),
        before: oldMember.nickname,
        after: newMember.nickname,
        moderator: audit?.moderator ?? null,
        reason: audit?.reason ?? null,
      },
      { ...subject, actorDiscordId: audit?.moderator?.id },
    );
  }

  const { added, removed } = diffRoleIds(oldMember.roles.cache.keys(), newMember.roles.cache.keys(), guild.id);
  // Join and verified roles are given by the bot; not a moderator action.
  if (
    (added.length || removed.length) &&
    !isSelfAction("roles", newMember.id) &&
    (await isServerEventEnabled(guild, "member.roles_changed"))
  ) {
    const audit = await findAuditEntry(guild, AuditLogEvent.MemberRoleUpdate, { targetId: newMember.id });
    if (audit?.bySelf) return;
    const ref = (id: string) => {
      const role = guild.roles.cache.get(id);
      return role ? roleRef(role) : { id };
    };
    await emitServerEvent(
      guild,
      "member.roles_changed",
      {
        member: memberRef(newMember),
        added: added.map(ref),
        removed: removed.map(ref),
        moderator: audit?.moderator ?? null,
        reason: audit?.reason ?? null,
      },
      { ...subject, actorDiscordId: audit?.moderator?.id },
    );
  }
});
