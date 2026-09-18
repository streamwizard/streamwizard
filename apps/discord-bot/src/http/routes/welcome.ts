import { Hono } from "hono";
import { z } from "zod";
import { cleanUpOldWelcomeChannel, sendTestWelcome } from "../../lib/welcome";
import type { AppEnv } from "../types";
import { readJson, snowflake } from "../validation";

export const welcomeRoutes = new Hono<AppEnv>();

// Called after web-admin moves the welcome channel: deletes the bot's
// welcome posts from the previous one in the background.
welcomeRoutes.post("/welcome-cleanup", async (c) => {
  const body = z.object({ previousChannelId: snowflake.nullable() }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const started = await cleanUpOldWelcomeChannel(c.get("guild"), body.data.previousChannelId);
  return c.json({ ok: true, started }, started ? 202 : 200);
});

welcomeRoutes.post("/test-welcome", async (c) => {
  const body = z.object({ discordUserId: snowflake }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const member = await c
    .get("guild")
    .members.fetch(body.data.discordUserId)
    .catch(() => null);
  if (!member) return c.json({ error: "Your Discord account isn't a member of the server" }, 404);

  const result = await sendTestWelcome(member);
  if (!result.ok)
    return c.json({ error: "No usable welcome channel is set, and the server has no system channel" }, 409);
  return c.json(result);
});
