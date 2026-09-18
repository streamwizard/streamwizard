import path from "node:path";
import type { Client } from "discord.js";
import type { AnyCommand } from "../types/discord";

const commandsDir = path.join(import.meta.dir, "..", "commands");

export async function loadCommands(client: Client) {
  const glob = new Bun.Glob("**/*.ts");

  for await (const file of glob.scan({ cwd: commandsDir, absolute: true })) {
    const command = (await import(file)).default as AnyCommand | undefined;

    if (!command?.data || !command?.execute) {
      console.warn(`[commands] Skipping ${file}: missing "data" or "execute"`);
      continue;
    }

    client.commands.set(command.data.name, command);
  }

  console.log(`[commands] Loaded ${client.commands.size} command(s)`);
}
