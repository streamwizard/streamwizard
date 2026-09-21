import type { RepliableInteraction } from "discord.js";

/** How long a throwaway ephemeral answer stays before the bot removes it. */
export const EPHEMERAL_TTL_MS = 5 * 60 * 1000;

/**
 * Deletes the interaction's reply after `ttlMs`, so ephemeral answers (the
 * category picker, "your ticket is open", link prompts) don't pile up in the
 * member's view of the channel. The interaction token lives 15 minutes, so the
 * delay must stay below that. A restart drops the timer, which only means the
 * message stays until the member dismisses it or reloads Discord.
 */
export function expireReply(interaction: RepliableInteraction, ttlMs = EPHEMERAL_TTL_MS): void {
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, ttlMs).unref();
}
