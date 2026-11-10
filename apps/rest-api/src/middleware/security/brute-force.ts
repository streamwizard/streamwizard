// middleware/security/brute-force.ts
import type { Context, Next } from "hono";
import { TtlCache } from "@repo/ttl-cache";
import { clientIp } from "@/middleware/security/client-ip";
import { logSecurityEvent } from "@/middleware/security/utils";

/**
 * Brute force protection: counts 401s per client IP and blocks the IP once it
 * reaches `maxAttempts` inside one window.
 *
 * Two caches, each with its own TTL:
 * - `failures`: a fixed-window counter, `windowMs` from the first 401.
 * - `blocks`: one entry per blocked IP that lives for the full
 *   `blockDurationMs`, however long ago the window opened.
 *
 * Only a request that authenticated (a 2xx with `c.get("user")` set by
 * `supabaseAuth()`) clears the counter. Other 2xx responses, such as a public
 * route, leave it alone.
 *
 * Per process, like every TtlCache: N replicas allow N times the limit.
 */

interface BruteForceOptions {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
  /** Injectable clock. Tests advance this instead of sleeping. */
  now: () => number;
}

// Bounds memory against many distinct IPs; the oldest entry goes first.
const MAX_TRACKED_IPS = 50_000;

// Routes that prove the caller another way (Twitch's HMAC signature, bearer
// secrets, node API keys). Their callers are a handful of fixed machines, so
// a lockout here could only ever block Twitch or our own nodes (SW-482).
const EXEMPT_PREFIXES = ["/webhooks/", "/internal/", "/api/obs-nodes", "/api/ingest-nodes"];

export function bruteForceProtection(options: Partial<BruteForceOptions> = {}) {
  const config: BruteForceOptions = {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour
    now: Date.now,
    ...options,
  };

  const failures = new TtlCache<{ count: number }>({
    ttlMs: config.windowMs,
    maxEntries: MAX_TRACKED_IPS,
    now: config.now,
  });
  // The value is the block's end time, for Retry-After.
  const blocks = new TtlCache<number>({
    ttlMs: config.blockDurationMs,
    maxEntries: MAX_TRACKED_IPS,
    now: config.now,
  });

  return async (c: Context, next: Next) => {
    if (EXEMPT_PREFIXES.some((prefix) => c.req.path.startsWith(prefix))) {
      await next();
      return;
    }

    const ip = clientIp(c);

    const blockedUntil = blocks.get(ip);
    if (blockedUntil !== undefined && blockedUntil !== null) {
      const waitSeconds = Math.max(1, Math.ceil((blockedUntil - config.now()) / 1000));

      c.header("Retry-After", waitSeconds.toString());
      return c.json(
        {
          error: "Too many failed attempts",
          message: `Your IP has been temporarily blocked due to multiple failed authentication attempts. Try again in ${Math.ceil(waitSeconds / 60)} minutes.`,
          retryAfter: waitSeconds,
        },
        429,
      );
    }

    await next();

    if (c.res.status === 401) {
      // Read after next(), so concurrent requests from one IP all count.
      const entry = failures.get(ip);
      const count = entry ? ++entry.count : 1;
      if (!entry) failures.set(ip, { count });

      if (count >= config.maxAttempts) {
        const until = config.now() + config.blockDurationMs;
        blocks.set(ip, until, { expiresAt: until });
        failures.delete(ip);

        logSecurityEvent("ip_blocked_brute_force", {
          ip,
          attempts: count,
          blocked_until: new Date(until).toISOString(),
        });
      }
    } else if (c.res.ok && c.get("user")) {
      failures.delete(ip);
    }
  };
}
