import { Events } from "discord.js";
import { reconcileVoiceSessions } from "../lib/activity-tracker";
import { startLogWorker } from "../lib/log-channel/worker";
import { reportError } from "@repo/sentry";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[discord] Logged in as ${client.user.tag}`);

    // Close any voice sessions left open by a previous run and start fresh ones
    // for members currently in voice.
    try {
      await reconcileVoiceSessions(client);
    } catch (error) {
      reportError(error, "discord-bot ready: reconcile voice sessions");
    }

    // Post platform events (new users, Discord links, deletions, ...) to the log channel.
    await startLogWorker(client);
  },
} satisfies BotEvent<typeof Events.ClientReady>;
