import type { MiddlewareHandler } from "hono";
import { secretsMatch } from "../lib/secret-compare";

/**
 * Server-to-server auth for /internal/* routes: `Authorization: Bearer <secret>`
 * with REST_API_INTERNAL_SECRET. Only web-admin's server side holds it; no
 * browser ever calls these routes. Without a secret the routes don't exist.
 */
export function internalAuth(secret: string | undefined): MiddlewareHandler {
  return async (c, next) => {
    if (!secret) return c.json({ error: "Not found" }, 404);
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!secretsMatch(token, secret)) return c.json({ error: "Unauthorized" }, 401);
    await next();
  };
}
