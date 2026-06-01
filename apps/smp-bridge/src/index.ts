// src/index.ts
import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { Sentry.captureException(err); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import "./lib/env";
import { minecraftWebSocketServer } from "./services/minecraftWebsocketServer";
import { handlers } from "./handlers/eventHandler";
import type { SmpBridgeHandlerContext } from "./handlers/eventHandler";
import { TwitchEventSubReceiver } from "@repo/twitch-eventsub";
import type { MinecraftMessageType } from "@/types/minecraft-incomming-websocket-messages";
import customLogger from "@/lib/logger";

const localhost = "ws://127.0.0.1:8080/ws";
const production = "wss://eventsub.wss.twitch.tv/ws";
const MINECRAFT_EVENT_TYPES: MinecraftMessageType[] = ["player.join", "player.quit", "player.death"];
const minecraftWsContext = {} as SmpBridgeHandlerContext;

const registerMinecraftWebSocketHandlers = () => {
    for (const eventType of MINECRAFT_EVENT_TYPES) {
        minecraftWebSocketServer.registerClientHandler(eventType, async (message) => {
            await handlers.processMinecraftEvent(eventType, message, minecraftWsContext);

            return {
                handled: true,
                eventType,
            };
        });
    }
};

async function main() {
    try {
        const EventSubReceiver = new TwitchEventSubReceiver(handlers, {
            wsUrl: production,
            conduitId: "6a9dfc09-7807-4f9d-830e-25f6ab00ed1f",
        });

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            await EventSubReceiver.disconnect();
            await minecraftWebSocketServer.stop();
            process.exit(0);
        });

        // Handle graceful shutdown
        process.on("SIGTERM", async () => {
            await EventSubReceiver.disconnect();
            await minecraftWebSocketServer.stop();
            process.exit(0);
        });

        registerMinecraftWebSocketHandlers();
        minecraftWebSocketServer.start();
        await EventSubReceiver.connect();
    } catch (error) {
        customLogger.error("❌ Failed to start receiver:", error);
        process.exit(1);
    }
}

main();
