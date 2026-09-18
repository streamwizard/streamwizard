import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

// Hash both sides so timingSafeEqual gets equal-length buffers and the
// comparison doesn't leak the secret's length.
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerSecret(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ") || !secretMatches(auth.slice(7).trim(), secret)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
