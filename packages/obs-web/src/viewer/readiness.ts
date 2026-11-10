// Waits until the node serves the instance's viewer page. The node answers
// 503 ("OBS is starting") until Selkies inside the container is up, and the
// probe needs no ticket, so nothing is spent while we wait.

const FIRST_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5_000;
/** Longer than an instance normally takes to boot. */
export const READY_TIMEOUT_MS = 3 * 60_000;

/** Delay before probe number `attempt` (0-based): 1 s, growing by half each time, at most 5 s. */
export function probeDelay(attempt: number): number {
  return Math.min(MAX_DELAY_MS, Math.round(FIRST_DELAY_MS * 1.5 ** attempt));
}

export interface WaitForViewerOptions {
  signal: AbortSignal;
  timeoutMs?: number;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Resolves true once `HEAD viewerRoot` answers 200, false when the timeout
 * runs out or the signal aborts. Network errors count as "not yet".
 */
export async function waitForViewer(viewerRoot: string, options: WaitForViewerOptions): Promise<boolean> {
  const { signal, timeoutMs = READY_TIMEOUT_MS, fetch = globalThis.fetch, sleep = abortableSleep, now = Date.now } = options;
  const deadline = now() + timeoutMs;
  for (let attempt = 0; !signal.aborted; attempt++) {
    try {
      const res = await fetch(viewerRoot, { method: "HEAD", cache: "no-store", credentials: "omit", signal });
      if (res.ok) return true;
    } catch {
      // Not reachable yet, or aborted; the loop condition sorts out which.
    }
    if (now() >= deadline) return false;
    await sleep(probeDelay(attempt), signal);
  }
  return false;
}
