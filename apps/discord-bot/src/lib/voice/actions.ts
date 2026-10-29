import { applyTempPermissions, presentGuestIds } from "./channel";
import { reasonFor, type VoiceContext } from "./command";
import { updateTempChannel } from "./store";

// What lock, unlock, hide and reveal share: flip one flag, recompute the
// channel's permissions, store the flag.

export type ChannelFlag = "locked" | "hidden";

export async function setChannelFlag(
  ctx: VoiceContext,
  flag: ChannelFlag,
  value: boolean,
  messages: { already: string; done: string; reason: string },
): Promise<string> {
  if (ctx.temp[flag] === value) return messages.already;
  const next = { ...ctx.temp, [flag]: value };
  // Discord first: if the bot lacks a permission nothing is stored, so the
  // flag never claims a lock the channel doesn't have.
  await applyTempPermissions(ctx.channel, next, {
    add: value ? presentGuestIds(ctx.channel, next.ownerId) : [],
    reason: reasonFor(ctx, messages.reason),
  });
  await updateTempChannel(ctx.channel.id, { [flag]: value });
  return messages.done;
}

/** The database turned down a second channel for one owner (discord_voice_channels_guild_owner_key). */
export function isOwnerTaken(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23505";
}
