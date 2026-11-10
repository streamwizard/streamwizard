import { sweepSceneCredentials } from "./revoke";

const SWEEP_INTERVAL_MS = 60_000;

/** Backstop for /internal/revoke: once a minute, close sockets whose overlay
 *  key was reset or whose scene is gone. One query for every open overlay. */
export function startRevokeSweep(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    void sweepSceneCredentials().then((closed) => {
      if (closed > 0) console.log(`[revoke] sweep closed ${closed} stale overlay socket(s)`);
    });
  }, SWEEP_INTERVAL_MS);
}
