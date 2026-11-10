import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { ServiceAuth, ServiceScope } from "@repo/service-token";
import { readBearerToken } from "@repo/service-token/bearer";

// Hash both sides so timingSafeEqual gets equal-length buffers and the
// comparison doesn't leak the secret's length.
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export interface ServiceTokenAuthConfig {
  /** The action these routes need: `discord-guilds`. */
  scope: ServiceScope;
  /** `createServiceAuth({ audience: "discord-bot", jwks: env.DISCORD_BOT_SERVICE_JWKS })`. */
  auth: ServiceAuth;
  /** DISCORD_BOT_INTERNAL_SECRET. Accepted next to service tokens until web-admin has moved over (SW-494). */
  legacySecret?: string;
}

/** `Authorization: Bearer <service token>` for `scope`, or for now the old shared secret. */
export function serviceTokenAuth({ scope, auth, legacySecret }: ServiceTokenAuthConfig): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    const token = readBearerToken(header);
    if (legacySecret && token !== null && secretMatches(token.trim(), legacySecret)) return next();
    if (!(await auth.authorize(header, scope)).ok) return c.json({ error: "Unauthorized" }, 401);
    await next();
  };
}
