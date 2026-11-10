import { TtlCache } from "./index";

export interface MissLimiterOptions {
  /** Misses allowed per key inside one window. */
  limit: number;
  windowMs: number;
  maxEntries?: number;
  /** Injectable clock. Tests advance this instead of sleeping. */
  now?: () => number;
}

/**
 * Counts failed lookups per key (usually a client IP) and says when to stop
 * answering. Built for secret-in-the-URL lookups: a real visitor almost never
 * misses, someone guessing misses on nearly every request. Once a key is over
 * the limit the caller should answer "not found" without asking the database,
 * hits included, so a blocked guesser learns nothing either way.
 *
 * Fixed window from the first miss. In-memory and per process, like the other
 * limiters built on TtlCache: N instances allow N times the limit.
 */
export class MissLimiter {
  private readonly counts: TtlCache<{ count: number }>;
  private readonly limit: number;

  constructor(options: MissLimiterOptions) {
    this.limit = options.limit;
    this.counts = new TtlCache({ ttlMs: options.windowMs, maxEntries: options.maxEntries, now: options.now });
  }

  isBlocked(key: string): boolean {
    return (this.counts.get(key)?.count ?? 0) >= this.limit;
  }

  recordMiss(key: string): void {
    const entry = this.counts.get(key);
    if (entry) entry.count++;
    else this.counts.set(key, { count: 1 });
  }
}
