import { Events } from "discord.js";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[discord] Logged in as ${client.user.tag}`);
  },
} satisfies BotEvent<typeof Events.ClientReady>;
