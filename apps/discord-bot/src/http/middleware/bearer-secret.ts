import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { readBearerToken } from "@repo/service-token/bearer";

// Hash both sides so timingSafeEqual gets equal-length buffers and the
// comparison doesn't leak the secret's length.
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerSecret(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const token = readBearerToken(c.req.header("Authorization"));
    if (token === null || !secretMatches(token.trim(), secret)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
