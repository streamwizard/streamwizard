import { Sentry } from "./sentry";
import "./lib/env";
import { TwitchApi } from "@repo/twitch-api";
import { runPendingClipsWorker } from "./functions/pending-clips";
import { runHourlySync } from "./functions/hourly-sync";

async function main() {
  const twitchApi = new TwitchApi();
  let running = true;

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    running = false;
    console.log("All workers stopped");
    process.exit(0);
  });

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    running = false;
    console.log("All workers stopped");
    process.exit(0);
  });

  process.on("uncaughtException", (err) => { Sentry.captureException(err); });
  process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });

  console.log("Starting workers...");

  await Promise.allSettled([runPendingClipsWorker(twitchApi, () => running), runHourlySync(twitchApi, () => running)]);
}

main();
