import { TtlCache } from "@repo/ttl-cache";

export interface TokenBucketOptions {
  /** Tokens added per second, up to `burst`. */
  ratePerSecond: number;
  /** Bucket size: requests allowed at once from a full bucket. */
  burst: number;
  maxEntries?: number;
  /** Injectable clock. Tests advance this instead of sleeping. */
  now?: () => number;
}

/**
 * Per-key request rate limits: each key has a bucket of `burst` tokens that
 * refills at `ratePerSecond`, and each request takes one. Refilled lazily on
 * the next request, so there is no timer. A bucket left alone until it is full
 * again is dropped from the cache: a missing bucket reads as a full one.
 *
 * In-memory and per process, like the other limiters on TtlCache: N replicas
 * allow N times the rate.
 */
export class TokenBucketLimiter {
  private readonly buckets: TtlCache<{ tokens: number; at: number }>;
  private readonly rate: number;
  private readonly burst: number;
  private readonly refillMs: number;
  private readonly now: () => number;

  constructor(options: TokenBucketOptions) {
    this.rate = options.ratePerSecond;
    this.burst = options.burst;
    this.now = options.now ?? Date.now;
    // From empty to full: after this an untouched bucket is the same as none.
    this.refillMs = Math.ceil((this.burst / this.rate) * 1000);
    this.buckets = new TtlCache({ ttlMs: this.refillMs, maxEntries: options.maxEntries ?? 10_000, now: this.now });
  }

  /**
   * Takes one token for `key`. null when taken; otherwise nothing is taken
   * and this returns the whole seconds until the next token (for Retry-After,
   * at least 1).
   */
  take(key: string): number | null {
    const now = this.now();
    const bucket = this.buckets.get(key);
    const tokens = bucket ? Math.min(this.burst, bucket.tokens + ((now - bucket.at) * this.rate) / 1000) : this.burst;
    if (tokens < 1) return Math.max(1, Math.ceil((1 - tokens) / this.rate));
    this.buckets.set(key, { tokens: tokens - 1, at: now }, { ttlMs: this.refillMs });
    return null;
  }

  /** Tests only. */
  clear(): void {
    this.buckets.clear();
  }
}
