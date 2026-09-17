import type { MiddlewareHandler } from "hono";
import type { Client } from "discord.js";
import type { AppEnv } from "../types";

/** Resolves `:guildId` to a guild the bot is in and stores it as `c.get("guild")`. */
export function resolveGuild(client: Client): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!client.isReady()) return c.json({ error: "Bot is not connected to Discord yet" }, 503);
    const guild = client.guilds.cache.get(c.req.param("guildId") ?? "");
    if (!guild) return c.json({ error: "Bot isn't in that server" }, 404);
    c.set("guild", guild);
    await next();
  };
}
