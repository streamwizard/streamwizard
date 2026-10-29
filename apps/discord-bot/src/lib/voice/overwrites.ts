import { OverwriteType, PermissionFlagsBits, type OverwriteData } from "discord.js";

// A temp channel's full permission set, computed from scratch every time
// anything changes (lock, hide, ban, transfer, ...). Starting from the
// category's own overwrites keeps whatever the server set up there (a
// members-only category stays members-only), and recomputing means "unlock"
// restores exactly what the category allowed instead of guessing.

const { ViewChannel, Connect, ManageChannels, MoveMembers } = PermissionFlagsBits;

/** What the owner gets: in even when locked or hidden, and enough to manage the channel by hand. */
export const OWNER_PERMISSIONS = ViewChannel | Connect | ManageChannels | MoveMembers;
/** The bot keeps the same, so a hidden or locked channel never shuts it out. */
export const BOT_PERMISSIONS = ViewChannel | Connect | ManageChannels | MoveMembers;
/** Whoever was in the channel when it got locked or hidden keeps getting back in. */
export const GUEST_PERMISSIONS = ViewChannel | Connect;
export const BANNED_PERMISSIONS = ViewChannel | Connect;

export interface RawOverwrite {
  id: string;
  type: OverwriteType;
  allow: bigint;
  deny: bigint;
}

export interface TempOverwriteInput {
  /** The category's overwrites, or none when the channel has no category. */
  parent: readonly RawOverwrite[];
  /** @everyone's role id, which is the server id. */
  everyoneId: string;
  botId: string;
  ownerId: string;
  locked: boolean;
  hidden: boolean;
  bannedUserIds: readonly string[];
  /** Members let in past a lock or a hide. Ignored while the channel is neither. */
  guestIds: readonly string[];
}

/**
 * Locking denies Connect to @everyone and takes Connect away from every role
 * the category allowed it to, since a role's allow beats @everyone's deny.
 * Hiding does the same with View Channel. Members with Administrator, or
 * staff with Move Members dragging someone in, still get through: that's
 * Discord, not something a channel can turn off.
 */
export function buildTempOverwrites(input: TempOverwriteInput): OverwriteData[] {
  const map = new Map<string, Omit<RawOverwrite, "id">>();
  for (const o of input.parent) map.set(o.id, { type: o.type, allow: o.allow, deny: o.deny });

  const update = (id: string, type: OverwriteType, change: (o: Omit<RawOverwrite, "id">) => Omit<RawOverwrite, "id">) =>
    map.set(id, change(map.get(id) ?? { type, allow: 0n, deny: 0n }));
  const grant = (id: string, bits: bigint) =>
    update(id, OverwriteType.Member, (o) => ({ ...o, allow: o.allow | bits, deny: o.deny & ~bits }));
  const refuse = (id: string, bits: bigint) =>
    update(id, OverwriteType.Member, (o) => ({ ...o, allow: o.allow & ~bits, deny: o.deny | bits }));
  const shut = (bits: bigint) => {
    for (const [id, o] of map) if (o.type === OverwriteType.Role) map.set(id, { ...o, allow: o.allow & ~bits });
    update(input.everyoneId, OverwriteType.Role, (o) => ({ ...o, allow: o.allow & ~bits, deny: o.deny | bits }));
  };

  if (input.locked) shut(Connect);
  if (input.hidden) shut(ViewChannel);
  if (input.locked || input.hidden) for (const id of input.guestIds) grant(id, GUEST_PERMISSIONS);
  for (const id of input.bannedUserIds) refuse(id, BANNED_PERMISSIONS);
  // Last, so a stale ban entry can never lock out the owner or the bot.
  grant(input.ownerId, OWNER_PERMISSIONS);
  grant(input.botId, BOT_PERMISSIONS);

  return [...map]
    .filter(([, o]) => o.allow !== 0n || o.deny !== 0n)
    .map(([id, o]) => ({ id, type: o.type, allow: o.allow, deny: o.deny }));
}

/**
 * Guests as they stand on the channel now: member overwrites that let
 * someone connect, other than the owner, the bot and banned people. A
 * previous owner lands here too, which is what a lock should do with them.
 */
export function currentGuestIds(
  overwrites: readonly RawOverwrite[],
  exclude: { ownerId: string; botId: string; bannedUserIds: readonly string[] },
): string[] {
  const skip = new Set([exclude.ownerId, exclude.botId, ...exclude.bannedUserIds]);
  return overwrites
    .filter((o) => o.type === OverwriteType.Member && (o.allow & Connect) !== 0n && !skip.has(o.id))
    .map((o) => o.id);
}
