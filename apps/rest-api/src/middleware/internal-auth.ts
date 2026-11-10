import type { MiddlewareHandler } from "hono";
import type { ServiceAuth, ServiceScope } from "@repo/service-token";
import { readBearerToken } from "@repo/service-token/bearer";
import { secretsMatch } from "@/lib/secret-compare";

export interface InternalAuthConfig {
  /** The action these routes need, e.g. `backups`. */
  scope: ServiceScope;
  /** Verifies service tokens: `createServiceAuth({ audience: "rest-api", jwks: env.REST_API_SERVICE_JWKS })`. */
  auth: ServiceAuth;
  /** REST_API_INTERNAL_SECRET. Accepted next to service tokens until web-admin has moved over (SW-494). */
  legacySecret?: string;
}

/**
 * Server-to-server auth for /internal/* routes: `Authorization: Bearer <token>`
 * with a 60-second service token for `scope` (only web-admin may sign one), or
 * for now the old shared secret. No browser ever calls these routes. With
 * neither configured the routes don't exist.
 */
export function internalAuth({ scope, auth, legacySecret }: InternalAuthConfig): MiddlewareHandler {
  return async (c, next) => {
    if (!auth.configured(scope) && !legacySecret) return c.json({ error: "Not found" }, 404);
    const header = c.req.header("authorization");
    if (legacySecret && secretsMatch(readBearerToken(header), legacySecret)) return next();
    const result = await auth.authorize(header, scope);
    if (!result.ok) return c.json({ error: "Unauthorized" }, 401);
    await next();
  };
}
