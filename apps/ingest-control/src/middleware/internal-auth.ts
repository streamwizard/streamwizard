import { createMiddleware } from "hono/factory";
import { env } from "../lib/env";

/**
 * Guards the /internal/* endpoints. The media plane must present the shared
 * secret. These endpoints are also only reachable on the private compose
 * network — the secret is defence in depth, not the only barrier.
 */
export const internalAuth = createMiddleware(async (c, next) => {
  const presented = c.req.header("x-ingest-secret");
  if (!presented || presented !== env.INGEST_CONTROL_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
