import { Sentry } from "./sentry";
import { env } from "./lib/env";
import { runEvaluationPass } from "@repo/alerting/engine";
import { homeEnv } from "@repo/alerting/home-env";

// The alert engine's ticker: run an evaluation pass, report the outcome to
// healthchecks.io, sleep, repeat. Replaces the old curl sidecar + web-monitor
// /api/alerts/evaluate route. The loop is sequential on purpose — a pass can
// legitimately take ~35s, and running them back-to-back can never self-overlap.
// The engine's own Supabase lock guards against a second alert-worker process.

process.on("uncaughtException", (err) => {
  console.error("[alert-worker] uncaughtException", err);
  Sentry.captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[alert-worker] unhandledRejection", reason);
  Sentry.captureException(reason);
});

let stopped = false;
let wakeFromSleep: (() => void) | undefined;

function requestStop(signal: string): void {
  if (stopped) {
    console.error(`[alert-worker] second ${signal} — exiting without finishing the pass`);
    process.exit(1);
  }
  stopped = true;
  console.log(`[alert-worker] ${signal} received — stopping after the current pass`);
  wakeFromSleep?.();
}
process.on("SIGTERM", () => requestStop("SIGTERM"));
process.on("SIGINT", () => requestStop("SIGINT"));

/** Sleep that a shutdown signal can cut short. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeFromSleep = undefined;
      resolve();
    }, ms);
    wakeFromSleep = () => {
      clearTimeout(timer);
      wakeFromSleep = undefined;
      resolve();
    };
  });
}

/** Dead-man's switch ping; best effort, never throws. */
async function ping(suffix = ""): Promise<void> {
  if (!env.HEALTHCHECKS_PING_URL) return;
  try {
    await fetch(env.HEALTHCHECKS_PING_URL + suffix, { signal: AbortSignal.timeout(10_000) });
  } catch {
    // A missed ping is what healthchecks.io exists to notice.
  }
}

async function tick(): Promise<boolean> {
  try {
    const summary = await runEvaluationPass();
    console.log(`[alert-worker] ${new Date().toISOString()} ok ${JSON.stringify(summary)}`);
    await ping();
    return true;
  } catch (err) {
    // runEvaluationPass is fail-open internally; reaching here means the
    // whole pass died (e.g. a bug, not a dependency outage).
    console.error(`[alert-worker] ${new Date().toISOString()} FAILED`, err);
    Sentry.captureException(err);
    await ping("/fail");
    return false;
  }
}

const once = process.argv.includes("--once");
console.log(`[alert-worker] starting env=${homeEnv()} tick=${env.TICK_SECONDS}s${once ? " (single pass)" : ""}`);

if (once) {
  const ok = await tick();
  await Sentry.flush(2_000).catch(() => {});
  process.exit(ok ? 0 : 1);
}

while (!stopped) {
  await tick();
  if (!stopped) await sleep(env.TICK_SECONDS * 1000);
}
console.log("[alert-worker] stopped");
