// src/index.ts
import { handlers } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";
import { env } from "./lib/env";
import { overlayWsClient } from "./overlay-ws-client";

const production = "wss://eventsub.wss.twitch.tv/ws";
const websocketUrl = env.WS_SERVER_URL;

async function main() {
  try {
    if (websocketUrl) {
      overlayWsClient.connect(websocketUrl, env.SUPABASE_SECRET_KEY);
    }

    const EventSubReceiver = new TwitchEventSubReceiver(handlers, {
      wsUrl: production,
      conduitId: env.TWITCH_CONDUIT_ID,
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

    await EventSubReceiver.connect();
  } catch (error) {
    console.error("❌ Failed to start receiver:", error);
    process.exit(1);
  }
}

main();
