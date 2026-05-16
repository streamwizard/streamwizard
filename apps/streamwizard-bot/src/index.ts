// src/index.ts
import { handlers } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";
import { env } from "@repo/env";
import { overlayWsClient } from "./overlay-ws-client";

const production = "wss://eventsub.wss.twitch.tv/ws";
const websocketUrl = "ws://localhost:8000";

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

    await EventSubReceiver.connect();
  } catch (error) {
    console.error("❌ Failed to start receiver:", error);
    process.exit(1);
  }
}

main();
