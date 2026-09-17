import { Hono } from "hono";
import type { Client } from "discord.js";
import { reportError } from "@repo/sentry";
import { bearerSecret } from "./middleware/bearer-secret";
import { resolveGuild } from "./middleware/guild";
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
// Everything except /health sits under /internal/guilds/:guildId, behind the
// bearer secret and the guild lookup. A new feature gets its own file in
// routes/ and one line here.
export function createInternalApp(client: Client, secret: string) {
  const app = new Hono<AppEnv>();

  app.get("/health", (c) => c.json({ ok: true, ready: client.isReady() }));

  const guilds = new Hono<AppEnv>();
  guilds.use("*", bearerSecret(secret));
  guilds.use("/:guildId/*", resolveGuild(client));

  guilds.route("/:guildId", cacheRoutes);
  guilds.route("/:guildId", roleRoutes);
  guilds.route("/:guildId", ticketRoutes);
  guilds.route("/:guildId", welcomeRoutes);
  guilds.route("/:guildId", builtMessageRoutes);
  guilds.route("/:guildId", channelRoutes);

  app.route("/internal/guilds", guilds);

  app.onError((error, c) => {
    reportError(error, "discord-bot internal-http", { path: c.req.path });
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
