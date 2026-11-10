/**
 * Helix rate limits.
 *
 * Twitch gives the app one bucket for app-token requests and one per user for
 * user-token requests. Every app-token call in every service shares the first
 * one (EventSub, badges, followers, clips, search, stream state), so when it
 * runs dry everything on the app token fails at once.
 *
 * The bucket refills continuously, so a short wait is usually enough for the
 * next point; `Ratelimit-Reset` is when it is *full* again, which can be most
 * of a minute away. One retry after at most a second keeps a brief spike from
 * becoming an error without holding requests open for the whole window.
 */

const RATE_LIMIT_MIN_WAIT_MS = 250;
export const RATE_LIMIT_MAX_WAIT_MS = 1000;
const WARN_INTERVAL_MS = 60_000;

type Headers = Record<string, unknown> | undefined;

function headerNumber(headers: Headers, name: string): number | undefined {
  const raw = headers?.[name];
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : undefined;
}

export function ratelimitRemaining(headers: Headers): number | undefined {
  return headerNumber(headers, "ratelimit-remaining");
}

/**
 * Milliseconds to wait before the one retry, or null when this response
 * shouldn't be retried.
 *
 * Only a 429 with `Ratelimit-Remaining: 0` is the general bucket. Twitch also
 * answers 429 for endpoint-specific limits (creating clips, for one), and
 * waiting a second won't lift those.
 */
export function rateLimitRetryDelay(status: number | undefined, headers: Headers, now = Date.now()): number | null {
  if (status !== 429) return null;
  if (ratelimitRemaining(headers) !== 0) return null;
  const reset = headerNumber(headers, "ratelimit-reset");
  const untilReset = reset === undefined ? RATE_LIMIT_MAX_WAIT_MS : reset * 1000 - now;
  return Math.min(RATE_LIMIT_MAX_WAIT_MS, Math.max(RATE_LIMIT_MIN_WAIT_MS, untilReset));
}

/** Readable message for a 429 that is given up on, in place of axios's "Request failed with status code 429". */
export function rateLimitMessage(method: string, endpoint: string, headers: Headers): string {
  const reset = headerNumber(headers, "ratelimit-reset");
  const resetAt = reset === undefined ? "unknown" : new Date(reset * 1000).toISOString();
  return `Twitch rate limit reached (${method} ${endpoint}); bucket resets at ${resetAt}`;
}

const lastWarned = new Map<string, number>();

/**
 * One line per bucket per minute. A dry bucket fails every request on it, and
 * a warning for each would bury the logs (and Sentry's quota) in duplicates.
 */
export function warnRateLimited(bucket: string, message: string, now = Date.now()): void {
  if (now - (lastWarned.get(bucket) ?? -Infinity) < WARN_INTERVAL_MS) return;
  lastWarned.set(bucket, now);
  console.warn(`[twitch-api] ${message}`);
}
