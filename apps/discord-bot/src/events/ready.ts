import { Events } from "discord.js";
import { reconcileVoiceSessions } from "../lib/activity-tracker";
import { startAnnouncementScheduler } from "../lib/announcements/scheduler";
import { startLogWorker } from "../lib/log-channel/worker";
import { reconcileOpenTickets } from "../lib/tickets/reconcile";
import { startTicketSweeper } from "../lib/tickets/sweeper";
import { reconcileTempChannels } from "../lib/voice/lifecycle";
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

    // Delete temp voice channels that emptied while the bot was down, forget
    // the ones that are gone, and seat anyone waiting in a lobby. Off the
    // ready path: it can create and delete channels.
    void reconcileTempChannels(client).catch((error) => reportError(error, "discord-bot ready: reconcile voice channels"));

    // Post platform events (new users, Discord links, deletions, ...) to the log channel.
    await startLogWorker(client);

    // Send announcements staff scheduled in web-admin when their time comes.
    startAnnouncementScheduler(client);

    // Fill whatever the ticket archive missed while the bot was down, and
    // close tickets whose channel is gone. Off the ready path: it walks
    // channels. The stale sweeper starts once that has run, so it never
    // reminds a ticket the reconcile is about to close.
    void reconcileOpenTickets(client)
      .catch((error) => reportError(error, "discord-bot ready: reconcile tickets"))
      .finally(() => startTicketSweeper(client));
  },
} satisfies BotEvent<typeof Events.ClientReady>;
