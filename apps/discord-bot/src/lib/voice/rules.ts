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

export type TargetAction = "kick" | "ban" | "unban" | "transfer" | "invite";

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
  /** Has one of this channel's voice staff roles. */
  targetIsStaff?: boolean;
}

/** Why the owner (or voice staff, on their behalf) can't point `action` at this member. Null when they can. */
export function targetRefusal(
  action: TargetAction,
  temp: Pick<TempChannel, "ownerId" | "bannedUserIds">,
  check: TargetCheck,
): string | null {
  const { actorId, botId, targetId } = check;
  const target = user(targetId);

  const actorIsOwner = actorId === temp.ownerId;
  if (targetId === actorId) {
    if (action === "kick") return "You can't kick yourself. Leaving works.";
    if (action === "ban") return actorIsOwner ? "You can't ban yourself from your own channel." : "You can't ban yourself.";
    if (action === "unban") return "You're not banned here.";
    if (action === "invite") return actorIsOwner ? "You're already in. It's your channel." : "You're staff here, so you get in anyway.";
    // Staff can transfer a channel they don't own; to themselves, that's a claim.
    return actorId === temp.ownerId ? "It's already yours." : "To take it yourself, use /voice-claim.";
  }
  if (targetId === botId && action === "transfer") {
    return "Flattered, but I'd never leave and this channel would never close. Pick a human.";
  }
  if (targetId === botId && action === "invite") return "I'm already here. I'm always here.";
  if (targetId === botId && action !== "unban") return "I keep this channel running, so I'm staying.";

  // Voice staff acting on the owner's behalf, pointed at the owner.
  if (targetId === temp.ownerId && action !== "transfer") {
    if (action === "ban") return `${target} owns this channel, so they can't be banned from it. /voice-transfer it to someone else first.`;
    if (action === "unban") return `${target} owns this channel. They're not banned.`;
    if (action === "invite") return `${target} owns this channel. They can always get in.`;
  }

  switch (action) {
    case "kick":
      if (check.targetIsStaff) return `${target} is staff here, so they can't be kicked or banned.`;
      return check.targetInChannel ? null : `${target} isn't in this channel.`;
    case "ban":
      if (check.targetIsStaff) return `${target} is staff here, so they can't be kicked or banned.`;
      if (temp.bannedUserIds.includes(targetId)) return `${target} is already banned here.`;
      if (!check.targetIsMember) return `${target} isn't in this server.`;
      if (temp.bannedUserIds.length >= BANNED_MAX) return `This channel has ${BANNED_MAX} bans already. Unban someone first.`;
      return null;
    case "unban":
      return temp.bannedUserIds.includes(targetId) ? null : `${target} isn't banned here.`;
    case "transfer":
      if (targetId === temp.ownerId) return `${target} already owns this channel.`;
      if (check.targetIsBot) return `${target} is a bot. It would run this channel in total silence forever. Pick a human.`;
      if (!check.targetInChannel) return `${target} needs to be in the channel first.`;
      if (check.targetOwnsOther) return `${target} already owns ${channel(check.targetOwnsOther)}. One channel each.`;
      return null;
    case "invite":
      if (check.targetIsBot) return `${target} is a bot. It would just sit there in silence. Invite a human.`;
      if (!check.targetIsMember) return `${target} isn't in this server. Run /voice-invite without a member to get a link for them.`;
      if (temp.bannedUserIds.includes(targetId)) return `${target} is banned here. Unban them first with /voice-unban.`;
      if (check.targetInChannel) return `${target} is already in here.`;
      return null;
  }
}

export interface RenameBlockCheck {
  actorId: string;
  targetId: string;
  targetIsBot: boolean;
  /** Has a voice staff role somewhere in the server. */
  targetIsStaff: boolean;
  alreadyBlocked: boolean;
}

/** Why staff can't block this member from renaming. Null when they can. */
export function renameBlockRefusal(check: RenameBlockCheck): string | null {
  const target = user(check.targetId);
  if (check.targetId === check.actorId) return "You can't block yourself.";
  if (check.targetIsBot) return `${target} is a bot. It doesn't rename anything.`;
  if (check.targetIsStaff) return `${target} is voice staff, so they can't be blocked from renaming.`;
  if (check.alreadyBlocked) return `${target} is already blocked from renaming.`;
  return null;
}

export interface ClaimCheck {
  claimerId: string;
  ownerId: string;
  claimerInChannel: boolean;
  ownerPresent: boolean;
  /** Another temp channel the claimer owns, if any. */
  claimerOwnsOther: string | null;
  /** Has one of this channel's voice staff roles: may take it over with the owner still there. */
  claimerIsStaff?: boolean;
}

/** /voice-claim takes a channel whose owner has left, or any channel for voice staff. Null when the claim goes through. */
export function claimRefusal(check: ClaimCheck): string | null {
  if (check.claimerId === check.ownerId) return "It's already yours.";
  if (!check.claimerInChannel) return "Join the channel first, then claim it.";
  if (check.ownerPresent && !check.claimerIsStaff) return `${user(check.ownerId)} is still here. You can claim it once they leave.`;
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
