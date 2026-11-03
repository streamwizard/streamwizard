import { Sentry } from "@/sentry";
import { flushSentry, reportFatal } from "@repo/sentry";
import { env } from "@/lib/env";
import { runEvaluationPass } from "@repo/alerting/engine";
import { homeEnv } from "@repo/alerting/home-env";
import { pingHealthchecks, reportCheckIn } from "@/worker/monitoring";
import { startHealthServer } from "@/worker/health-server";

process.on("uncaughtException", (err) => {
  reportFatal(err, "alert-worker");
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

async function tick(): Promise<boolean> {
  try {
    const summary = await runEvaluationPass();
    console.log(`[alert-worker] ${new Date().toISOString()} ok ${JSON.stringify(summary)}`);
    await pingHealthchecks();
    reportCheckIn(true);
    return true;
  } catch (err) {
    // The engine handles dependency failures internally. This catches a pass
    // that died as a whole, such as from a bug.
    console.error(`[alert-worker] ${new Date().toISOString()} FAILED`, err);
    Sentry.captureException(err);
    await pingHealthchecks("/fail");
    reportCheckIn(false);
    return false;
  }
}

export async function startWorker(): Promise<void> {
  const once = process.argv.includes("--once");
  console.log(`[alert-worker] starting env=${homeEnv()} tick=${env.TICK_SECONDS}s${once ? " (single pass)" : ""}`);

  if (once) {
    const ok = await tick();
    await Sentry.flush(2_000).catch(() => {});
    process.exit(ok ? 0 : 1);
  }

  const healthServer = startHealthServer(env.TICK_SECONDS);
  while (!stopped) {
    await tick();
    healthServer.markPassFinished();
    if (!stopped) await sleep(env.TICK_SECONDS * 1000);
  }
  healthServer.stop();
  console.log("[alert-worker] stopped");
  // A failed final pass would otherwise never reach Sentry.
  await flushSentry();
}
