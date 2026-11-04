import { Sentry } from "@/sentry";
import { env } from "@/lib/env";

/** Dead-man's switch ping; best effort, never throws. */
export async function pingHealthchecks(suffix = ""): Promise<void> {
  if (!env.HEALTHCHECKS_PING_URL) return;
  try {
    await fetch(env.HEALTHCHECKS_PING_URL + suffix, { signal: AbortSignal.timeout(10_000) });
  } catch {
    // A missed ping is what healthchecks.io exists to notice.
  }
}

// The Sentry monitor complements healthchecks.io in environments without a
// ping URL. Healthy check-ins are throttled to the monitor's one-minute
// schedule; failures always report.
const MONITOR_SLUG = "alert-worker-tick";
let lastHealthyCheckIn = 0;

export function reportCheckIn(ok: boolean): void {
  const now = Date.now();
  if (ok && now - lastHealthyCheckIn < 60_000) return;
  if (ok) lastHealthyCheckIn = now;

  Sentry.captureCheckIn(
    { monitorSlug: MONITOR_SLUG, status: ok ? "ok" : "error" },
    {
      schedule: { type: "interval", value: 1, unit: "minute" },
      checkinMargin: 2,
      maxRuntime: 5,
      timezone: "Etc/UTC",
    },
  );
}
