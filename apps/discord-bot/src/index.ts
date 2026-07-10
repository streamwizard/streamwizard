import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { Sentry.captureException(err); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });

import { client } from "./lib/discord-client";
import { env } from "./lib/env";
import { loadCommands } from "./handlers/commandHandler";
import { loadEvents } from "./handlers/eventHandler";
import { shutdownTracker } from "./lib/activity-tracker";

async function main() {
  await loadCommands(client);
  await loadEvents(client);

  // Flush buffered activity counts and close open voice sessions before exit so
  // we don't lose in-flight data on deploys/restarts.
  const shutdown = async () => {
    await shutdownTracker();
    await client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch((error) => {
  console.error("❌ Failed to start bot:", error);
  process.exit(1);
});
