import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";
import { BUCKETS } from "./buckets";

// Proxmox backup monitoring (docs/backup-monitoring-plan.md,
// docs/backup-sizes-plan.md). rest-api's poller writes one set of points per
// successful PBS poll (every 6 h, and a minute after each webhook), so
// /backups can chart usage and backup age over time. Current state and
// webhook events stay in Supabase; these are only the numbers.

export interface BackupPollMetrics {
  datastore: string;
  namespace: string;
  usage: { totalBytes: number; usedBytes: number; availBytes: number } | null;
  /** Deduplicated usage of our namespace, from the chunk indexes. */
  namespaceUsage: { logicalBytes: number; uniqueBytes: number; onDiskEstBytes: number | null } | null;
  vms: {
    vmid: number;
    name: string | null;
    ageSeconds: number | null;
    snapshotCount: number;
    verified: boolean;
    diskBytes: number | null;
    lastUploadedBytes: number | null;
    uniqueBytes: number | null;
    sharedBytes: number | null;
    onDiskEstBytes: number | null;
  }[];
  /**
   * What each backup run uploaded, written in the polls that recompute usage.
   * The point's time is the backup time, so writing one again overwrites it.
   */
  snapshots: {
    vmid: number;
    name: string | null;
    /** epoch seconds */
    time: number;
    uploadedBytes: number;
    uploadedRawBytes: number;
  }[];
}

export function trackBackupPoll(m: BackupPollMetrics): void {
  if (m.usage && m.usage.totalBytes > 0) {
    const point = new Point("backup_datastore")
      .tag("datastore", m.datastore)
      .tag("namespace", m.namespace)
      .intField("total_bytes", m.usage.totalBytes)
      .intField("used_bytes", m.usage.usedBytes)
      .intField("avail_bytes", m.usage.availBytes)
      .floatField("used_pct", (m.usage.usedBytes / m.usage.totalBytes) * 100);
    if (m.namespaceUsage) {
      point.intField("ns_logical_bytes", m.namespaceUsage.logicalBytes).intField("ns_unique_bytes", m.namespaceUsage.uniqueBytes);
      if (m.namespaceUsage.onDiskEstBytes !== null) point.intField("ns_ondisk_est_bytes", m.namespaceUsage.onDiskEstBytes);
    }
    pushPoint(point, BUCKETS.vmBackups);
  }

  for (const vm of m.vms) {
    const point = new Point("backup_vm")
      .tag("datastore", m.datastore)
      .tag("namespace", m.namespace)
      .tag("vmid", String(vm.vmid))
      .tag("name", vm.name ?? `VM ${vm.vmid}`)
      .intField("snapshots", vm.snapshotCount)
      .intField("verified", vm.verified ? 1 : 0);
    if (vm.ageSeconds !== null) point.intField("age_s", Math.round(vm.ageSeconds));
    if (vm.diskBytes !== null) point.intField("disk_bytes", vm.diskBytes);
    if (vm.lastUploadedBytes !== null) point.intField("last_uploaded_bytes", vm.lastUploadedBytes);
    if (vm.uniqueBytes !== null) point.intField("unique_bytes", vm.uniqueBytes);
    if (vm.sharedBytes !== null) point.intField("shared_bytes", vm.sharedBytes);
    if (vm.onDiskEstBytes !== null) point.intField("ondisk_est_bytes", vm.onDiskEstBytes);
    pushPoint(point, BUCKETS.vmBackups);
  }

  for (const snap of m.snapshots) {
    const point = new Point("backup_snapshot")
      .tag("datastore", m.datastore)
      .tag("namespace", m.namespace)
      .tag("vmid", String(snap.vmid))
      .tag("name", snap.name ?? `VM ${snap.vmid}`)
      .intField("uploaded_bytes", snap.uploadedBytes)
      .intField("uploaded_raw_bytes", snap.uploadedRawBytes)
      .timestamp(new Date(snap.time * 1000));
    pushPoint(point, BUCKETS.vmBackups);
  }
}
