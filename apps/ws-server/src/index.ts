import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "ws-server"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import { env } from "@/lib/env";
import { flushSentry, reportFatal } from "@repo/sentry";
import { isMetricsEnabled, initMetrics, BUCKETS } from "@repo/metrics";
import { fetch, websocket } from "@/app";
import { startKeepalive } from "@/modules/connections/keepalive";
import { startMonitorSnapshots } from "@/modules/monitor/jobs";
import { startRevokeSweep } from "@/modules/revoke/jobs";
import type { ConnectionData } from "@/types";

initMetrics(BUCKETS.wsServer);

const server = Bun.serve<ConnectionData>({ port: env.PORT, fetch, websocket });

startKeepalive();
startMonitorSnapshots();
startRevokeSweep();

// Without a signal handler the container is killed outright on deploy and any
// queued Sentry event dies with it.
const shutdown = async () => {
  console.log("[ws-server] shutting down");
  server.stop();
  await flushSentry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[ws-server] listening on port ${server.port}`);
console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
