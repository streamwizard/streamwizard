import { rooms } from "@/modules/rooms/rooms";
import { monitors, getBotSockets } from "@/modules/monitor";
import { consumers } from "@/modules/consumers/consumers";

const PING_INTERVAL_MS = 30_000;

/** Ping all connections every 30 s to keep them alive through Cloudflare (100 s idle timeout). */
export function startKeepalive(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    for (const room of rooms.values()) {
      for (const sub of room.subscribers) {
        sub.ping();
      }
    }
    for (const ws of monitors) {
      ws.ping();
    }
    for (const ws of consumers) {
      ws.ping();
    }
    // Bots too: a quiet producer (e.g. the auto-switcher status publisher with
    // nothing enabled) would otherwise idle past Cloudflare's timeout and churn
    // through reconnects.
    for (const ws of getBotSockets().values()) {
      ws.ping();
    }
  }, PING_INTERVAL_MS);
}
