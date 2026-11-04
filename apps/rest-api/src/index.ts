import { Sentry } from "@/sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "rest-api"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import { env } from "@/env";
import { configureTracking, flushTracking } from "@repo/posthog/server";
import { flushSentry, reportError, reportFatal } from "@repo/sentry";
import { isMetricsEnabled, initMetrics, BUCKETS } from "@repo/metrics";
import { createApp } from "@/app";
import { viewerCountPoller } from "@/modules/streams/viewer-count-poller";
import { twitchTokenValidator } from "@/jobs/twitch-token-validator";
import { liveRoleSweeper } from "@/modules/discord-live/role-sweeper";
import { backupPoller } from "@/modules/backups/poller";
import { assetReconciler } from "@/jobs/asset-reconciler";
import { cmsScheduler } from "@/jobs/cms-scheduler";

initMetrics(BUCKETS.restApi);

const app = createApp();

const server = Bun.serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: env.PORT,
});

// Without a signal handler the container is killed outright on deploy and any
// queued Sentry event dies with it.
configureTracking({ app: "rest-api", onError: (error) => reportError(error, "rest-api: posthog") });

const shutdown = async () => {
  console.log("[rest-api] shutting down");
  server.stop();
  await flushTracking();
  await flushSentry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[rest-api] listening on port ${env.PORT}`);

// Pollers live in memory only; pick up streams that were live across the restart.
void viewerCountPoller.resume();
// Twitch wants every user token validated on boot and hourly; the sweep also
// keeps integrations_twitch.twitch_scopes current for the scope prompts.
twitchTokenValidator.start();
// The Discord live role is event-driven; this pass fixes what a restart or a
// settings change in web-admin left behind. No-op without the Discord env.
liveRoleSweeper.start();
// Proxmox backup monitoring; null (off) unless the PBS env vars are set.
if (backupPoller) {
  backupPoller.start();
  console.log("[backup-poller] active");
}
// Blog and guides: scheduled posts go live, failed cache refreshes retry.
// Always on; the cache refresh is skipped without CMS_SITE_URL + secret.
cmsScheduler.start();
// Media library hygiene: abandoned uploads and R2 objects with no row. Null
// (off) unless the R2 env vars are set.
if (assetReconciler) {
  assetReconciler.start();
  console.log("[asset-reconciler] active");
}
console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
