import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => {
  reportFatal(err, "obs-auto-switcher");
});
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
});

import { flushSentry, reportFatal } from "@repo/sentry";
import { initMetrics, BUCKETS } from "@repo/metrics";
import { createApp } from "@/app";

// IRL auto scene-switcher. Consumes the 1 Hz ingest stats feed from
// ws-server, runs a per-user threshold/streak state machine, and drives
// cloud OBS scenes through each node's internal command endpoint.
//
// Run exactly ONE replica: streaks/overrides/session selection live in
// memory, and two engines would race conflicting scene switches.

initMetrics(BUCKETS.autoSwitcher);

const { engine, configStore, statsFeed, statusPublisher, fetch } = createApp();

await configStore.start();
statusPublisher.connect();
statsFeed.connect();
engine.start();

console.log(`[obs-auto-switcher] running — ${configStore.size} enabled config(s) loaded`);

Bun.serve({ port: Number(process.env.PORT ?? 8010), fetch });

const shutdown = async () => {
  console.log("[obs-auto-switcher] shutting down");
  engine.stop();
  configStore.stop();
  statsFeed.disconnect();
  statusPublisher.disconnect();
  await flushSentry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
