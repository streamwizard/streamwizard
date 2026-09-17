import { Hono } from "hono";
import { z } from "zod";
import { closeGuildSessions, invalidateSettingsCache } from "../../lib/activity-tracker";
import { invalidateLogSettingsCache } from "../../lib/log-channel/worker";
import { invalidateCommandPermissionCache, invalidateGuildPermissionCache } from "../../lib/permissions";
import type { AppEnv } from "../types";
import { readJson } from "../validation";

// web-admin calls these after it saves settings, so the bot drops its stale
// in-memory copy instead of waiting for the cache to expire.
export const cacheRoutes = new Hono<AppEnv>();

cacheRoutes.post("/cache/permissions", async (c) => {
  const body = z.object({ commandName: z.string().min(1).max(32).optional() }).safeParse(await readJson(c, {}));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const guildId = c.get("guild").id;
  if (body.data.commandName) invalidateCommandPermissionCache(guildId, body.data.commandName);
  else invalidateGuildPermissionCache(guildId);
  return c.json({ ok: true });
});

cacheRoutes.post("/cache/log-settings", (c) => {
  invalidateLogSettingsCache();
  return c.json({ ok: true });
});

cacheRoutes.post("/cache/activity", async (c) => {
  const body = z.object({ trackingDisabled: z.boolean() }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const guildId = c.get("guild").id;
  invalidateSettingsCache(guildId);
  // Without this, open voice sessions keep running until the next voice
  // event after the settings cache would have expired anyway.
  if (body.data.trackingDisabled) await closeGuildSessions(guildId);
  return c.json({ ok: true });
});
