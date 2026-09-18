import { Hono } from "hono";
import { z } from "zod";
import { migrateVerifiedRole } from "../../lib/setup-wizard";
import type { AppEnv } from "../types";
import { readJson, snowflake } from "../validation";

export const roleRoutes = new Hono<AppEnv>();

roleRoutes.post("/verified-role", async (c) => {
  const body = z.object({ oldRoleId: snowflake, newRoleId: snowflake }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  // Fetching every member and swapping roles one by one can take a while on
  // big servers; migrateVerifiedRole reports its own errors, so don't wait.
  void migrateVerifiedRole(c.get("guild"), body.data.oldRoleId, body.data.newRoleId);
  return c.json({ ok: true }, 202);
});
