import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { Sentry.captureException(err); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });

import { client } from "./lib/discord-client";
import { env } from "./lib/env";
import { loadCommands } from "./handlers/commandHandler";
import { loadEvents } from "./handlers/eventHandler";

async function main() {
  await loadCommands(client);
  await loadEvents(client);

  process.on("SIGINT", async () => {
    await client.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await client.destroy();
    process.exit(0);
  });

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch((error) => {
  console.error("❌ Failed to start bot:", error);
  process.exit(1);
});
