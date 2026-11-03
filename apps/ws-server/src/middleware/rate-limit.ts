import { TtlCache } from "@repo/ttl-cache";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

// Fixed window from the first attempt; entries expire lazily, so no sweep timer.
const attempts = new TtlCache<{ count: number }>({ ttlMs: RATE_WINDOW_MS, maxEntries: 50_000 });

/**
 * Pre-auth upgrade limiter, RATE_LIMIT per window per role and IP. Roles get
 * separate budgets so a burst of browser-source reconnects (a ws-server restart
 * reconnects every subscriber at once) can't lock out the publisher.
 */
export function isRateLimited(role: "publisher" | "subscriber", ip: string): boolean {
  const key = `${role}:${ip}`;
  const entry = attempts.get(key);
  if (!entry) {
    attempts.set(key, { count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}
