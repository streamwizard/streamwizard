// The worker is one loop. It is alive while that loop keeps finishing passes,
// whether a pass succeeded or not. A pass that never returns (a hung request
// without a timeout) stops all alerting silently, and only a restart cures it.

/** A pass can legitimately take ~35s, so the floor is generous. */
const MIN_STALE_AFTER_MS = 5 * 60_000;

/** How long without a finished pass before the loop counts as stuck. */
export function staleAfterMs(tickSeconds: number): number {
  return Math.max(MIN_STALE_AFTER_MS, tickSeconds * 1000 * 5);
}

export function isLoopAlive(lastPassAt: number, now: number, tickSeconds: number): boolean {
  return now - lastPassAt < staleAfterMs(tickSeconds);
}
