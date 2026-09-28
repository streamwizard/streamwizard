import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets from request headers. Both
 * sides are hashed first so the lengths always match and timingSafeEqual
 * can't leak the expected length by throwing.
 */
export function secretsMatch(given: string | undefined | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
