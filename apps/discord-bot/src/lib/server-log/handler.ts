import type { ClientEvents } from "discord.js";
import { reportError } from "@repo/sentry";
import type { BotEvent } from "../../types/discord";

/** A server-log event listener that reports errors instead of leaving an unhandled rejection. */
export function serverLogEvent<K extends keyof ClientEvents>(
  name: K,
  execute: (...args: ClientEvents[K]) => Promise<void>
): BotEvent<K> {
  return {
    name,
    async execute(...args: ClientEvents[K]) {
      try {
        await execute(...args);
      } catch (error) {
        reportError(error, `discord-bot server-log: ${String(name)}`);
      }
    },
  };
}
