// Report throttling for code that can fail on every message, tick or retry.
//
// The free plan gives the whole org ~167 errors a day, and @repo/sentry's own
// limiter (20 a day per error, 200 a day per process) is a safety net, not a
// budget. A loop that fails the same way on every message reports the first
// failure, then at most one per interval while it keeps failing.
//
// Kept free of Sentry imports so tests can use it while mocking @repo/sentry.

import { describeError } from "./safe-error";

export interface ReportThrottleOptions {
  /** Minimum time between two reports for the same key. Infinity: once per process. */
  intervalMs: number;
  /** Keys tracked before the map is cleared, so per-id keys can't grow it forever. */
  maxKeys?: number;
  now?: () => number;
}

/**
 * Returns `allow(key)`: true for the first call with a key, then true again
 * only once `intervalMs` has passed since the last allowed call.
 */
export function createReportThrottle(options: ReportThrottleOptions): (key: string) => boolean {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 500;
  const lastAllowed = new Map<string, number>();

  return (key: string): boolean => {
    const t = now();
    const last = lastAllowed.get(key);
    if (last !== undefined && t - last < options.intervalMs) return false;
    if (last === undefined && lastAllowed.size >= maxKeys) lastAllowed.clear();
    lastAllowed.set(key, t);
    return true;
  };
}

/**
 * A throttle key for "the same failure": describeError's line with ids and
 * numbers blanked, so "clip 123 failed" and "clip 456 failed" share a key.
 */
export function errorFingerprint(error: unknown): string {
  return describeError(error)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 200);
}
