import { Hono } from "hono";
import type { Client } from "discord.js";
import type { ServiceAuth } from "@repo/service-token";
import { reportError } from "@repo/sentry";
import { serviceTokenAuth } from "./middleware/service-auth";
import { resolveGuild } from "./middleware/guild";
import { announcementRoutes } from "./routes/announcements";
import { builtMessageRoutes } from "./routes/built-messages";
import { cacheRoutes } from "./routes/cache";
import { channelRoutes } from "./routes/channels";
import { roleRoutes } from "./routes/roles";
import { ticketRoutes } from "./routes/tickets";
import { welcomeRoutes } from "./routes/welcome";
import type { AppEnv } from "./types";

// Internal API for web-admin's Discord dashboard. web-admin writes settings to
// the DB itself and calls here afterwards so the bot drops stale caches, runs
// side effects (verified-role migration, closing voice sessions) and performs
// actions that need the gateway client (ticket panel, test welcome, publishing
// built messages, creating channels).
//
// Everything except /health sits under /internal/guilds/:guildId, behind a
// service token (scope `discord-guilds`, only web-admin may sign one) and the
// guild lookup. A new feature gets its own file in routes/ and one line here.
//
// Without service keys (or the old secret) only /health is served: the
// container healthcheck needs it whether or not the dashboard API is
// configured.
export interface InternalAuthConfig {
  /** Verifies service tokens addressed to discord-bot (DISCORD_BOT_SERVICE_JWKS). */
  auth: ServiceAuth;
  /** DISCORD_BOT_INTERNAL_SECRET, accepted until web-admin has moved over (SW-494). */
  legacySecret?: string;
}

export function createInternalApp(client: Client, { auth, legacySecret }: InternalAuthConfig) {
  const app = new Hono<AppEnv>();

  // Liveness: answers as long as the process runs. `ready` is the gateway
  // state and is information only. A Discord outage must not make the
  // healthcheck fail, or Swarm would restart the bot in a loop.
  app.get("/health", (c) => c.json({ ok: true, ready: client.isReady() }));

  if (!auth.configured("discord-guilds") && !legacySecret) return app;

  const guilds = new Hono<AppEnv>();
  guilds.use("*", serviceTokenAuth({ scope: "discord-guilds", auth, legacySecret }));
  guilds.use("/:guildId/*", resolveGuild(client));

  guilds.route("/:guildId", cacheRoutes);
  guilds.route("/:guildId", roleRoutes);
  guilds.route("/:guildId", ticketRoutes);
  guilds.route("/:guildId", welcomeRoutes);
  guilds.route("/:guildId", builtMessageRoutes);
  guilds.route("/:guildId", channelRoutes);
  guilds.route("/:guildId", announcementRoutes);

  app.route("/internal/guilds", guilds);

  app.onError((error, c) => {
    reportError(error, "discord-bot internal-http", { path: c.req.path });
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
