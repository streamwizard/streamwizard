import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { Sentry.captureException(err); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import "./lib/env";
import { handleUpgrade } from "./handlers/auth";
import { websocketHandlers } from "./handlers/ws";
import { rooms } from "./rooms";
import { monitors, broadcastSnapshot } from "./monitor";
import { isMetricsEnabled } from "@repo/metrics";
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
  for (const ws of monitors) {
    ws.ping();
  }
}, 30_000);

// Send a room snapshot to connected monitors every 5 s
setInterval(broadcastSnapshot, 5_000);

console.log(`[ws-server] listening on port ${server.port}`);
console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
