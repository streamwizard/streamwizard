import { serviceAuthHeader } from "@repo/service-token";
import { env } from "@/lib/env";
import { ConfigStore } from "@/modules/config/config-store";
import { Engine } from "@/modules/engine/engine";
import { StatsFeed } from "@/modules/ws-server/stats-feed";
import { StatusPublisher } from "@/modules/ws-server/status-publisher";

/**
 * Wires the service together without starting anything: the engine, the
 * config store feeding it, and the two ws-server connections (consumer feed in,
 * bot status pushes out). index.ts starts and stops what this returns.
 */
export function createApp() {
  // Each (re)connect signs a fresh service token (bot / consumer scope).
  const statusPublisher = new StatusPublisher(env.WS_SERVER_URL, () => serviceAuthHeader("bot"));
  const engine = new Engine(statusPublisher);
  const configStore = new ConfigStore((userId, config) => engine.onConfigChanged(userId, config));

  const statsFeed = new StatsFeed(env.WS_SERVER_URL, () => serviceAuthHeader("consumer"), {
    onIngestStats: (userId, payload) => engine.onStats(userId, payload),
    onConfigPush: (userId, payload) => void configStore.applyPush(userId, payload),
    onSessionEnded: (userId, payload) => engine.onSessionEnded(userId, payload),
  });

  /** Liveness probe (docker healthcheck / alert-worker). */
  function fetch(req: Request): Response {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, monitors: engine.monitorCount });
    }
    return new Response("Not Found", { status: 404 });
  }

  return { engine, configStore, statsFeed, statusPublisher, fetch };
}
