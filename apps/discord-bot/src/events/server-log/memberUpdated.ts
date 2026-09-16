import { AuditLogEvent, Events } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
import { diffRoleIds, memberRef, roleRef } from "../../lib/server-log/refs";
import { isSelfAction } from "../../lib/server-log/self-actions";

// Timeouts, nickname and role changes all arrive as GuildMemberUpdate. When the
// old member wasn't cached there's nothing to compare with, so nothing is logged.
// (Membership screening is handled by src/events/guildMemberUpdate.ts.)
export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (oldMember.partial) return;
    const guild = newMember.guild;
    const member = memberRef(newMember);
    const options = { subjectDiscordId: newMember.id };
    const memberUpdate = (key: string) => ({
      type: AuditLogEvent.MemberUpdate,
      targetId: newMember.id,
      where: (entry: { changes: { key: string }[] }) => entry.changes.some((change) => change.key === key),
    });

    const oldUntil = oldMember.communicationDisabledUntilTimestamp ?? 0;
    const newUntil = newMember.communicationDisabledUntilTimestamp ?? 0;
    const timedOut = newUntil > Date.now() && newUntil !== oldUntil;
    const timeoutRemoved = oldUntil > Date.now() && newUntil <= Date.now();
    if (timedOut) {
      await emitAuditedEvent(
        guild,
        "member.timed_out",
        memberUpdate("communication_disabled_until"),
        { member, until: new Date(newUntil).toISOString() },
        options,
      );
    } else if (timeoutRemoved) {
      await emitAuditedEvent(
        guild,
        "member.timeout_removed",
        memberUpdate("communication_disabled_until"),
        { member },
        options,
      );
    }

    if (oldMember.nickname !== newMember.nickname) {
      await emitAuditedEvent(
        guild,
        "member.nickname_changed",
        memberUpdate("nick"),
        { member, before: oldMember.nickname, after: newMember.nickname },
        options,
      );
    }

    const { added, removed } = diffRoleIds(oldMember.roles.cache.keys(), newMember.roles.cache.keys(), guild.id);
    // Join and verified roles are given by the bot; not a moderator action.
    if ((added.length || removed.length) && !isSelfAction("roles", newMember.id)) {
      const ref = (id: string) => {
        const role = guild.roles.cache.get(id);
        return role ? roleRef(role) : { id };
      };
      await emitAuditedEvent(
        guild,
        "member.roles_changed",
        { type: AuditLogEvent.MemberRoleUpdate, targetId: newMember.id },
        { member, added: added.map(ref), removed: removed.map(ref) },
        options,
      );
    }
  },
} satisfies BotEvent<typeof Events.GuildMemberUpdate>;
