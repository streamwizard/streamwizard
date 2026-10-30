const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

/**
 * Pre-auth upgrade limiter, RATE_LIMIT per window per role and IP. Roles get
 * separate budgets so a burst of browser-source reconnects (a ws-server restart
 * reconnects every subscriber at once) can't lock out the publisher.
 */
export function isRateLimited(role: "publisher" | "subscriber", ip: string): boolean {
  const key = `${role}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, RATE_WINDOW_MS);
