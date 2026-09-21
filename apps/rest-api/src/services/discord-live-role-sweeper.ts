import { reportError } from "@repo/sentry";
import { reconcileLiveRoles, type ReconcileResult } from "../lib/discord-live-role";

/**
 * Keeps the Discord live role honest between events. stream.online and
 * stream.offline do the real-time work; this pass catches what they miss
 * (a restart mid-stream, a role swapped in web-admin, an opt-out while
 * live) by diffing discord_live_roles against broadcaster_live_status.
 * Discord is only called for the differences.
 */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/** Let the process settle before the first pass; every restart runs one. */
const FIRST_SWEEP_DELAY_MS = 30 * 1000;

export interface LiveRoleSweeperDeps {
  reconcile: () => Promise<ReconcileResult>;
}

export function createLiveRoleSweeper(deps: LiveRoleSweeperDeps) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<ReconcileResult> | null = null;

  function sweep(): Promise<ReconcileResult> {
    if (inFlight) return inFlight;
    inFlight = deps.reconcile().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function start(): void {
    if (timer) return;
    const run = () =>
      sweep()
        .then((r) => {
          if (r.granted || r.revoked || r.moved || r.failed) {
            console.log(
              `[discord-live-role] granted ${r.granted}, revoked ${r.revoked}, moved ${r.moved}, failed ${r.failed}`,
            );
          }
        })
        .catch((error) => reportError(error, "discord-live-role: sweep"));
    setTimeout(run, FIRST_SWEEP_DELAY_MS).unref?.();
    timer = setInterval(run, SWEEP_INTERVAL_MS);
    timer.unref?.();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { sweep, start, stop };
}

export const liveRoleSweeper = createLiveRoleSweeper({ reconcile: reconcileLiveRoles });
