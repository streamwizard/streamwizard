import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "streamwizard-bot"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import { flushSentry, reportFatal } from "@repo/sentry";
import { handlers } from "./handlers/eventHandler";
import { ConduitShardManager, parseShardIds, type EventSubLifecycleEvent } from "@repo/twitch-eventsub";
import { env } from "./lib/env";
import { createEventSubLogger, emitEventSubRow } from "./lib/eventsub-log";
import { createEventSubLogGroup } from "./lib/eventsub-log-group";
import { createEventSubTelemetry, createShardHeartbeat } from "./lib/eventsub-telemetry";
import { overlayWsClient } from "./overlay-ws-client";
import { isMetricsEnabled, initMetrics, BUCKETS } from "@repo/metrics";

initMetrics(BUCKETS.bot);

const production = "wss://eventsub.wss.twitch.tv/ws";
const websocketUrl = env.WS_SERVER_URL;

async function main() {
  try {
    if (websocketUrl) {
      overlayWsClient.connect(websocketUrl, env.SUPABASE_SECRET_KEY);
    }

    // One receiver per conduit shard. Each shard gets its own logger and
    // telemetry: both keep per-socket state (boot, migration in flight).
    // Metrics + Sentry trail, and a platform_events row per lifecycle event
    // for the Discord log channel. Alerting is the fleet engine's job.
    const shardIds = env.EVENTSUB_SHARD_IDS ? parseShardIds(env.EVENTSUB_SHARD_IDS) : undefined;
    // Several shards in one process hit a deploy or a network blip together;
    // their log rows are merged so the channel gets one row, not one per shard.
    const logGroup = (shardIds?.length ?? env.EVENTSUB_SHARD_COUNT) > 1 ? createEventSubLogGroup(emitEventSubRow) : null;
    const perShard = new Map<string, (event: EventSubLifecycleEvent) => void>();
    const onShardEvent = (shardId: string, event: EventSubLifecycleEvent) => {
      let handle = perShard.get(shardId);
      if (!handle) {
        const telemetry = createEventSubTelemetry(shardId);
        const log = createEventSubLogger(shardId, logGroup?.emit);
        handle = (e) => {
          telemetry(e);
          log(e);
        };
        perShard.set(shardId, handle);
      }
      handle(event);
    };

    const shards = new ConduitShardManager(handlers, {
      wsUrl: production,
      conduitId: env.TWITCH_CONDUIT_ID,
      shardCount: env.EVENTSUB_SHARD_COUNT,
      shardIds,
      onLifecycleEvent: onShardEvent,
      onHeartbeat: createShardHeartbeat(),
    });

    const shutdown = async () => {
      overlayWsClient.disconnect();
      await shards.stop();
      await logGroup?.flush();
      await flushSentry();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
    console.log(`[eventsub] running shards ${shards.getShardIds().join(", ")} of ${env.EVENTSUB_SHARD_COUNT}`);
    await shards.start();
  } catch (error) {
    // Caught here, so the unhandledRejection hook above never sees it —
    // capture explicitly or a failed startup is invisible in Sentry.
    console.error("❌ Failed to start receiver:", error);
    Sentry.captureException(error);
    await flushSentry();
    process.exit(1);
  }
}

main();
