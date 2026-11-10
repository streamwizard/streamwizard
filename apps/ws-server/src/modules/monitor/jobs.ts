import { broadcastSnapshot } from "./broadcast";

const SNAPSHOT_INTERVAL_MS = 5_000;

/** Send a room snapshot to connected monitors every 5 s. */
export function startMonitorSnapshots(): ReturnType<typeof setInterval> {
  return setInterval(broadcastSnapshot, SNAPSHOT_INTERVAL_MS);
}
