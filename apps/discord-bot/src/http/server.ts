import { createHash, timingSafeEqual } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Client, Guild } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets";
import { closeGuildSessions, invalidateSettingsCache } from "../lib/activity-tracker";
import { env } from "../lib/env";
import { invalidateCommandPermissionCache, invalidateGuildPermissionCache } from "../lib/permissions";
import { migrateVerifiedRole } from "../lib/setup-wizard";
import { deleteTicketPanel, postTicketPanel } from "../lib/tickets";
import { cleanUpOldWelcomeChannel, sendTestWelcome } from "../lib/welcome";

// Internal API for web-admin's Discord dashboard. web-admin writes settings to
// the DB itself and calls here afterwards so the bot drops stale caches, runs
// side effects (verified-role migration, closing voice sessions) and performs
// actions that need the gateway client (ticket panel, test welcome).

declare module "hono" {
  interface ContextVariableMap {
    guild: Guild;
  }
}

const snowflake = z.string().regex(/^\d{17,20}$/);

// Hash both sides so timingSafeEqual gets equal-length buffers and the
// comparison doesn't leak the secret's length.
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearerSecret(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ") || !secretMatches(auth.slice(7).trim(), secret)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}

export function createInternalApp(client: Client, secret: string) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, ready: client.isReady() }));

  const guilds = new Hono();
  guilds.use("*", bearerSecret(secret));
  guilds.use("/:guildId/*", async (c, next) => {
    if (!client.isReady()) return c.json({ error: "Bot is not connected to Discord yet" }, 503);
    const guild = client.guilds.cache.get(c.req.param("guildId") ?? "");
    if (!guild) return c.json({ error: "Bot isn't in that server" }, 404);
    c.set("guild", guild);
    await next();
  });

  guilds.post("/:guildId/cache/permissions", async (c) => {
    const body = z.object({ commandName: z.string().min(1).max(32).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "Invalid body" }, 400);
    const guildId = c.get("guild").id;
    if (body.data.commandName) invalidateCommandPermissionCache(guildId, body.data.commandName);
    else invalidateGuildPermissionCache(guildId);
    return c.json({ ok: true });
  });

  guilds.post("/:guildId/cache/activity", async (c) => {
    const body = z.object({ trackingDisabled: z.boolean() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid body" }, 400);
    const guildId = c.get("guild").id;
    invalidateSettingsCache(guildId);
    // Without this, open voice sessions keep running until the next voice
    // event after the settings cache would have expired anyway.
    if (body.data.trackingDisabled) await closeGuildSessions(guildId);
    return c.json({ ok: true });
  });

  guilds.post("/:guildId/verified-role", async (c) => {
    const body = z.object({ oldRoleId: snowflake, newRoleId: snowflake }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid body" }, 400);
    // Fetching every member and swapping roles one by one can take a while on
    // big servers; migrateVerifiedRole reports its own errors, so don't wait.
    void migrateVerifiedRole(c.get("guild"), body.data.oldRoleId, body.data.newRoleId);
    return c.json({ ok: true }, 202);
  });

  // Owns panel_channel_id + panel_message_id so the stored location always
  // matches Discord. `channelId` moves the panel (null removes it); omitted,
  // the panel is re-posted where it is. The old message is found through the
  // stored location, so callers must not write panel_channel_id themselves.
  guilds.post("/:guildId/ticket-panel", async (c) => {
    const body = z.object({ channelId: snowflake.nullable().optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "Invalid body" }, 400);

    const guild = c.get("guild");
    const settings = await getTicketSettings(supabase, guild.id);
    const targetChannelId = body.data.channelId === undefined ? settings?.panel_channel_id : body.data.channelId;

    if (!targetChannelId) {
      await deleteTicketPanel(guild, settings);
      await upsertTicketSettings(supabase, guild.id, { panel_channel_id: null, panel_message_id: null });
      return c.json({ ok: true, channelId: null, messageId: null });
    }

    const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!channel?.isSendable()) {
      return c.json({ error: "The panel channel is gone or the bot can't post in it" }, 409);
    }

    const panelMessageId = await postTicketPanel(guild, channel, settings);
    await upsertTicketSettings(supabase, guild.id, { panel_channel_id: channel.id, panel_message_id: panelMessageId });
    return c.json({ ok: true, channelId: channel.id, messageId: panelMessageId });
  });

  // Called after web-admin moves the welcome channel: deletes the bot's
  // welcome posts from the previous one in the background.
  guilds.post("/:guildId/welcome-cleanup", async (c) => {
    const body = z.object({ previousChannelId: snowflake.nullable() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid body" }, 400);
    const started = await cleanUpOldWelcomeChannel(c.get("guild"), body.data.previousChannelId);
    return c.json({ ok: true, started }, started ? 202 : 200);
  });

  guilds.post("/:guildId/test-welcome", async (c) => {
    const body = z.object({ discordUserId: snowflake }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid body" }, 400);

    const member = await c.get("guild").members.fetch(body.data.discordUserId).catch(() => null);
    if (!member) return c.json({ error: "Your Discord account isn't a member of the server" }, 404);

    const result = await sendTestWelcome(member);
    if (!result.ok) return c.json({ error: "No usable welcome channel is set, and the server has no system channel" }, 409);
    return c.json(result);
  });

  app.route("/internal/guilds", guilds);

  app.onError((error, c) => {
    reportError(error, "discord-bot internal-http", { path: c.req.path });
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}

/** Starts the server when DISCORD_BOT_INTERNAL_SECRET is set; returns a stop function. */
export function startInternalServer(client: Client): (() => void) | null {
  if (!env.DISCORD_BOT_INTERNAL_SECRET) {
    console.log("[internal-http] DISCORD_BOT_INTERNAL_SECRET not set, internal server disabled");
    return null;
  }
  const app = createInternalApp(client, env.DISCORD_BOT_INTERNAL_SECRET);
  const server = Bun.serve({ port: env.DISCORD_BOT_INTERNAL_PORT, fetch: app.fetch });
  console.log(`[internal-http] Listening on :${server.port}`);
  return () => server.stop();
}
