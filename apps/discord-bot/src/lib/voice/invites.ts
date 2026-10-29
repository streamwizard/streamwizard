// Links made by /voice-invite without a member: a one-time server invite that
// points at a temp channel. When someone joins the server through one, the
// bot lets them into that channel past a lock or hide. Discord doesn't say
// which invite a new member used, but a one-use invite is gone once it's
// used, so the pending link missing from the channel's invites is the one.
//
// In memory like the rest of the voice state (the bot is a single instance).
// A restart forgets open links: the newcomer still gets into the server, and
// the owner can /voice-invite them by name.

export const INVITE_MAX_AGE_SECONDS = 60 * 60;
/** Open links a channel may have at once. */
export const INVITES_PER_CHANNEL_MAX = 10;

export interface PendingInvite {
  code: string;
  guildId: string;
  channelId: string;
  /** ms since epoch. */
  expiresAt: number;
}

const pending = new Map<string, PendingInvite>();

function prune(now: number): void {
  for (const [code, invite] of pending) if (invite.expiresAt <= now) pending.delete(code);
}

export function addPendingInvite(invite: PendingInvite): void {
  pending.set(invite.code, invite);
}

export function pendingInvites(guildId: string, now = Date.now()): PendingInvite[] {
  prune(now);
  return [...pending.values()].filter((invite) => invite.guildId === guildId);
}

export function countChannelInvites(channelId: string, now = Date.now()): number {
  prune(now);
  let count = 0;
  for (const invite of pending.values()) if (invite.channelId === channelId) count++;
  return count;
}

export function forgetInvites(codes: readonly string[]): void {
  for (const code of codes) pending.delete(code);
}

/** The channel is gone, and Discord deleted its invites with it. */
export function forgetChannelInvites(channelId: string): void {
  for (const [code, invite] of pending) if (invite.channelId === channelId) pending.delete(code);
}

/**
 * The pending links someone just used: unexpired, and no longer among the
 * channel's live invites. More than one means two people joined at once and
 * there's no telling who used which.
 */
export function usedInviteCodes(candidates: readonly PendingInvite[], liveCodes: ReadonlySet<string>, now: number): string[] {
  return candidates.filter((invite) => invite.expiresAt > now && !liveCodes.has(invite.code)).map((invite) => invite.code);
}
