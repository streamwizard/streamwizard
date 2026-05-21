import "./lib/env";
import { handleUpgrade } from "./handlers/auth";
import { websocketHandlers } from "./handlers/ws";
import { rooms } from "./rooms";
import type { ConnectionData } from "./types";

const PORT = Number(process.env.PORT ?? 8000);

const server = Bun.serve<ConnectionData>({
  port: PORT,
  fetch: handleUpgrade,
  websocket: websocketHandlers,
});

// Ping all connections every 30 s to keep them alive through Cloudflare (100 s idle timeout)
setInterval(() => {
  for (const room of rooms.values()) {
    room.publisher?.ping();
    for (const sub of room.subscribers) {
      sub.ping();
    }
  }
}, 30_000);

console.log(`[ws-server] listening on port ${server.port}`);
