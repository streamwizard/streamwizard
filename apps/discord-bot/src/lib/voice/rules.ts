// Who may do what to a temp channel, and what to do with a leftover one. All
// pure (ids and flags in, a decision or the member-facing sentence out), so
// every rule is tested without Discord.

export interface TempChannel {
  channelId: string;
  guildId: string;
  hubId: string | null;
  ownerId: string;
  locked: boolean;
  hidden: boolean;
  bannedUserIds: string[];
  /** ms since epoch. */
  createdAt: number;
}

/** How many people a channel may hold on its ban list (the table's check). */
export const BANNED_MAX = 100;

/**
 * A channel the bot just created sits empty for a moment before its owner is
 * moved in. Cleanups leave channels this young alone so they never delete one
 * out from under the member it was made for.
 */
export const CREATE_GRACE_MS = 30_000;

const user = (id: string) => `<@${id}>`;
const channel = (id: string) => `<#${id}>`;

/** Why `actorId` can't run an owner-only command here. Null when they own it. */
export function ownerRefusal(actorId: string, temp: Pick<TempChannel, "ownerId">, ownerPresent: boolean): string | null {
  if (actorId === temp.ownerId) return null;
  return ownerPresent
    ? `Only the channel owner can do that. That's ${user(temp.ownerId)}.`
    : `Only the channel owner can do that. ${user(temp.ownerId)} left, so /voice-claim makes it yours.`;
}

export type TargetAction = "kick" | "ban" | "unban" | "transfer";

export interface TargetCheck {
  actorId: string;
  /** The bot's own user id. */
  botId: string;
  targetId: string;
  targetIsBot: boolean;
  /** Still a member of the server. */
  targetIsMember: boolean;
  targetInChannel: boolean;
  /** Another temp channel the target owns, if any. */
  targetOwnsOther: string | null;
}

/** Why the owner can't point `action` at this member. Null when they can. */
export function targetRefusal(
  action: TargetAction,
  temp: Pick<TempChannel, "bannedUserIds">,
  check: TargetCheck,
): string | null {
  const { actorId, botId, targetId } = check;
  const target = user(targetId);

  if (targetId === actorId) {
    if (action === "kick") return "You can't kick yourself. Leaving works.";
    if (action === "ban") return "You can't ban yourself from your own channel.";
    if (action === "unban") return "You're not banned here.";
    return "It's already yours.";
  }
  if (targetId === botId && action !== "unban") return "I keep this channel running, so I'm staying.";

  switch (action) {
    case "kick":
      return check.targetInChannel ? null : `${target} isn't in this channel.`;
    case "ban":
      if (temp.bannedUserIds.includes(targetId)) return `${target} is already banned here.`;
      if (!check.targetIsMember) return `${target} isn't in this server.`;
      if (temp.bannedUserIds.length >= BANNED_MAX) return `This channel has ${BANNED_MAX} bans already. Unban someone first.`;
      return null;
    case "unban":
      return temp.bannedUserIds.includes(targetId) ? null : `${target} isn't banned here.`;
    case "transfer":
      if (check.targetIsBot) return "Bots can't own a channel.";
      if (!check.targetInChannel) return `${target} needs to be in the channel first.`;
      if (check.targetOwnsOther) return `${target} already owns ${channel(check.targetOwnsOther)}. One channel each.`;
      return null;
  }
}

export interface ClaimCheck {
  claimerId: string;
  ownerId: string;
  claimerInChannel: boolean;
  ownerPresent: boolean;
  /** Another temp channel the claimer owns, if any. */
  claimerOwnsOther: string | null;
}

/** /voice-claim only takes a channel whose owner has left. Null when the claim goes through. */
export function claimRefusal(check: ClaimCheck): string | null {
  if (check.claimerId === check.ownerId) return "It's already yours.";
  if (!check.claimerInChannel) return "Join the channel first, then claim it.";
  if (check.ownerPresent) return `${user(check.ownerId)} is still here. You can claim it once they leave.`;
  if (check.claimerOwnsOther) return `You already own ${channel(check.claimerOwnsOther)}. One channel each.`;
  return null;
}

export type ReconcileAction = "keep" | "delete" | "forget";

/**
 * What to do with a stored temp channel during the startup reconcile and
 * /voice-clean: forget it when Discord no longer has it, delete it when nobody
 * (bots don't count) is in it, keep it otherwise. A just-created channel is
 * kept, see CREATE_GRACE_MS.
 */
export function reconcileAction(input: { exists: boolean; humans: number; ageMs: number }, graceMs = CREATE_GRACE_MS): ReconcileAction {
  if (!input.exists) return "forget";
  if (input.humans > 0) return "keep";
  if (input.ageMs < graceMs) return "keep";
  return "delete";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** /voice-clean's answer. */
export function cleanSummary({ deleted, forgotten }: { deleted: number; forgotten: number }): string {
  if (deleted === 0 && forgotten === 0) return "Nothing to clean. Every temporary channel has people in it.";
  const parts = [
    deleted > 0 && `deleted ${plural(deleted, "empty channel", "empty channels")}`,
    forgotten > 0 && `forgot ${plural(forgotten, "channel that was already gone", "channels that were already gone")}`,
  ].filter(Boolean);
  return `Cleaned up: ${parts.join(" and ")}.`;
}
