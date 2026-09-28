import { assertValidFluxDuration, runFluxQuery } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// Read side of backup-metrics.ts (written by rest-api's backup poller).

export interface BackupSeriesPoint {
  time: string;
  value: number;
}

export interface BackupVmSeriesPoint {
  time: string;
  /** VM label ("pfsense (100)"), used as the series key by the charts. */
  nodeId: string;
  value: number;
}

/** Datastore used % over time. */
export function queryBackupDatastoreUsedPct(fluxRange = "24h", window = "1h", opts?: QueryOpts): Promise<BackupSeriesPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    from(bucket: "${resolveBucket(opts)}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "backup_datastore" and r._field == "used_pct")
      |> group()
      |> aggregateWindow(every: ${window}, fn: max, createEmpty: false)
      |> yield(name: "backup_used_pct")
  `;
  return runFluxQuery(query, (row) => ({ time: row._time ?? "", value: Number(row._value) }));
}

async function queryBackupVmField(field: "age_s" | "ondisk_est_bytes", fluxRange: string, window: string, opts?: QueryOpts) {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const query = `
    from(bucket: "${resolveBucket(opts)}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "backup_vm" and r._field == "${field}")
      |> group(columns: ["vmid", "name"])
      |> aggregateWindow(every: ${window}, fn: max, createEmpty: false)
      |> yield(name: "backup_vm_${field}")
  `;
  return runFluxQuery<BackupVmSeriesPoint>(query, (row) => ({
    time: row._time ?? "",
    nodeId: `${row.name ?? "VM"} (${row.vmid ?? "?"})`,
    value: Number(row._value),
  }));
}

/** Age of the newest backup per VM, in hours (a sawtooth: resets at each run). */
export async function queryBackupVmAgeHours(fluxRange = "24h", window = "1h", opts?: QueryOpts): Promise<BackupVmSeriesPoint[]> {
  const points = await queryBackupVmField("age_s", fluxRange, window, opts);
  return points.map((p) => ({ ...p, value: p.value / 3600 }));
}

/** Estimated bytes each VM's kept backups take on PBS (deduplicated, compressed). */
export function queryBackupVmOnDiskBytes(fluxRange = "24h", window = "1h", opts?: QueryOpts): Promise<BackupVmSeriesPoint[]> {
  return queryBackupVmField("ondisk_est_bytes", fluxRange, window, opts);
}
