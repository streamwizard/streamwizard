import { RateLimitError, REST, Routes, type Client, type VoiceChannel } from "discord.js";
import { RenameLimiter, RENAME_WINDOW_MS } from "./rename-limit";

// /voice-rename goes through its own REST client that rejects on a rate limit
// instead of waiting it out. The shared client would hold the request for up
// to ten minutes (Discord's 2-per-10-minutes rename limit) with the command
// hanging, and would hold up the bot's other edits to that channel with it.

const limiter = new RenameLimiter();
let rest: REST | null = null;

function renameRest(client: Client): REST {
  if (!rest) {
    if (!client.token) throw new Error("Bot token missing for the rename client");
    rest = new REST({ rejectOnRateLimit: () => true }).setToken(client.token);
  }
  return rest;
}

export type RenameResult = { ok: true } | { ok: false; retryAt: number };

/** Renames the channel, or says when Discord will allow it. */
export async function renameTempChannel(channel: VoiceChannel, name: string, reason: string): Promise<RenameResult> {
  const wait = limiter.waitMs(channel.id);
  if (wait > 0) return { ok: false, retryAt: Date.now() + wait };

  try {
    await renameRest(channel.client).patch(Routes.channel(channel.id), { body: { name }, reason });
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    // Discord's own wait wins: someone else may have renamed the channel too.
    const ms = Math.max(error.retryAfter, error.sublimitTimeout, error.timeToReset) || RENAME_WINDOW_MS;
    limiter.block(channel.id, ms);
    return { ok: false, retryAt: Date.now() + ms };
  }
  limiter.record(channel.id);
  return { ok: true };
}

export function forgetRenameHistory(channelId: string): void {
  limiter.forget(channelId);
}
