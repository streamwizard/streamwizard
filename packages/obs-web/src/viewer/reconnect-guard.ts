// Decides whether the viewer may mint a new ticket after the node says the
// viewer session expired. A session that expires again right after each
// reconnect (clock skew, a node that keeps restarting, a revoked user) must
// not turn into a mint loop: the node allows 30 tickets a minute per user.

export type ReconnectDecision = { action: "now" } | { action: "wait"; ms: number } | { action: "stop" };

export interface ReconnectGuardOptions {
  /** Least time between two reconnects. */
  minIntervalMs?: number;
  /** Expiries allowed inside `windowMs` before giving up. */
  maxAttempts?: number;
  windowMs?: number;
  now?: () => number;
}

export function createReconnectGuard({
  minIntervalMs = 5_000,
  maxAttempts = 3,
  windowMs = 120_000,
  now = Date.now,
}: ReconnectGuardOptions = {}) {
  let attempts: number[] = [];

  return {
    /** Call once per expiry; the caller reconnects now, after `ms`, or not at all. */
    next(): ReconnectDecision {
      const at = now();
      attempts = attempts.filter((t) => at - t < windowMs);
      if (attempts.length >= maxAttempts) return { action: "stop" };
      const last = attempts.at(-1);
      const scheduled = last === undefined ? at : Math.max(at, last + minIntervalMs);
      attempts.push(scheduled);
      return scheduled === at ? { action: "now" } : { action: "wait", ms: scheduled - at };
    },
    /** A reconnect the user asked for starts the count over. */
    reset() {
      attempts = [];
    },
  };
}
