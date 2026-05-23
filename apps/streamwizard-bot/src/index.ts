import { handlers } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";
import { env } from "./lib/env";
import { overlayWsClient } from "./overlay-ws-client";
import { isMetricsEnabled } from "@repo/metrics";

const production = "wss://eventsub.wss.twitch.tv/ws";
const websocketUrl = env.WS_SERVER_URL;

async function main() {
  try {
    if (websocketUrl) {
      overlayWsClient.connect(websocketUrl, env.SUPABASE_SECRET_KEY);
    }

    const EventSubReceiver = new TwitchEventSubReceiver(handlers, {
      wsUrl: production,
      conduitId: "6a9dfc09-7807-4f9d-830e-25f6ab00ed1f",
    });

    process.on("SIGINT", async () => {
      overlayWsClient.disconnect();
      await EventSubReceiver.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      overlayWsClient.disconnect();
      await EventSubReceiver.disconnect();
      process.exit(0);
    });

    console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
    await EventSubReceiver.connect();
  } catch (error) {
    console.error("❌ Failed to start receiver:", error);
    process.exit(1);
  }
}

main();
