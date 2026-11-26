import { TtlCache } from "@repo/ttl-cache";

export interface AttemptLimiterOptions {
  /** Length of one window, from a key's first attempt. */
  windowMs: number;
  maxEntries?: number;
  /** Injectable clock. Tests advance this instead of sleeping. */
  now?: () => number;
}

export interface AttemptLimit {
  key: string;
  /** Attempts allowed for this key inside one window. */
  limit: number;
}

/**
 * Fixed-window attempt counters for one kind of attempt, keyed by whatever
 * the caller limits on ("user:<id>", "ip:<addr>"). `take` counts an attempt
 * before the work it guards, synchronously, so parallel requests each see the
 * ones before them and can't slip past a limit. `refund` gives an attempt
 * back, for limits that count failures before knowing the outcome (a lookup
 * that turned out valid). A caller that knows the outcome first can instead
 * call `take` only for failures, right after deciding, with no await between.
 *
 * In-memory and per process, like the other limiters on TtlCache: N replicas
 * allow N times the limit.
 */
export class AttemptLimiter {
  private readonly counts: TtlCache<{ count: number; resetAt: number }>;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: AttemptLimiterOptions) {
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
    this.counts = new TtlCache({ ttlMs: options.windowMs, maxEntries: options.maxEntries ?? 10_000, now: this.now });
  }

  /**
   * Counts one attempt against every key, unless one of them is already at
   * its limit: then nothing is counted and this returns the seconds until
   * the last blocking window ends (for Retry-After). null when counted.
   */
  take(limits: readonly AttemptLimit[]): number | null {
    const now = this.now();
    let waitMs = 0;
    for (const { key, limit } of limits) {
      const entry = this.counts.get(key);
      if (entry && entry.count >= limit) waitMs = Math.max(waitMs, entry.resetAt - now);
    }
    if (waitMs > 0) return Math.max(1, Math.ceil(waitMs / 1000));

    for (const { key } of limits) {
      const entry = this.counts.get(key);
      if (entry) entry.count++;
      else this.counts.set(key, { count: 1, resetAt: now + this.windowMs }, { expiresAt: now + this.windowMs });
    }
    return null;
  }

  /**
   * When `key`'s current window ends (ms since epoch), or null when it has no
   * open window. Read only: counts nothing. Lets a caller tell one window
   * from the next, e.g. to report a refusal once per window.
   */
  windowEndsAt(key: string): number | null {
    return this.counts.get(key)?.resetAt ?? null;
  }

  /** Gives back one attempt per key, counted earlier by `take`. */
  refund(keys: readonly string[]): void {
    for (const key of keys) {
      const entry = this.counts.get(key);
      if (entry && entry.count > 0) entry.count--;
    }
  }

  /** Tests only. */
  clear(): void {
    this.counts.clear();
  }
}
