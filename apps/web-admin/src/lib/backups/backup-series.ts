import { queryBackupDatastoreUsedPct, queryBackupVmAgeHours, queryBackupVmOnDiskBytes } from "@repo/metrics";

/** Chart series for /backups, from the points rest-api's backup poller writes.
 * Each series fails on its own: one broken query leaves the others drawn. */
export async function fetchBackupSeries(fluxRange = "24h", window = "1h") {
  const [usedPct, vmAgeHours, vmOnDiskBytes] = await Promise.all([
    queryBackupDatastoreUsedPct(fluxRange, window).catch(() => []),
    queryBackupVmAgeHours(fluxRange, window).catch(() => []),
    queryBackupVmOnDiskBytes(fluxRange, window).catch(() => []),
  ]);
  return { usedPct, vmAgeHours, vmOnDiskBytes };
}

export type BackupSeries = Awaited<ReturnType<typeof fetchBackupSeries>>;
