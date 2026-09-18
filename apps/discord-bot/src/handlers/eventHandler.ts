import path from "node:path";
import type { Client } from "discord.js";
import { reportError } from "@repo/sentry";
import type { BotEvent } from "../types/discord";

const eventsDir = path.join(import.meta.dir, "..", "events");

export async function loadEvents(client: Client) {
  const glob = new Bun.Glob("**/*.ts");
  let count = 0;

  for await (const file of glob.scan({ cwd: eventsDir, absolute: true })) {
    const event = (await import(file)).default as BotEvent | undefined;

    if (!event?.name || !event?.execute) {
      console.warn(`[events] Skipping ${file}: missing "name" or "execute"`);
      continue;
    }

    // Every listener reports instead of leaving an unhandled rejection: one
    // failing handler must not take the others, or the process, with it.
    const run = async (...args: Parameters<typeof event.execute>) => {
      try {
        await event.execute(...args);
      } catch (error) {
        reportError(error, `discord-bot event: ${String(event.name)}`);
      }
    };
    if (event.once) client.once(event.name, run);
    else client.on(event.name, run);
    count++;
  }

  console.log(`[events] Loaded ${count} event(s)`);
}
