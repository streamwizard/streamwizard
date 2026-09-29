import { Point } from "@influxdata/influxdb-client";
import { pushPoint } from "./influx-client";

// Proxmox backup monitoring (docs/backup-monitoring-plan.md). rest-api's
// poller writes one set of points per successful PBS poll (every 6 h, and a
// minute after each webhook), so /backups can chart usage and backup age over
// time. Current state and webhook events stay in Supabase; these are only
// the numbers.

export interface BackupPollMetrics {
  datastore: string;
  namespace: string;
  usage: { totalBytes: number; usedBytes: number; availBytes: number } | null;
  vms: {
    vmid: number;
    name: string | null;
    ageSeconds: number | null;
    snapshotCount: number;
    lastSizeBytes: number | null;
    verified: boolean;
  }[];
}

export function trackBackupPoll(m: BackupPollMetrics): void {
  if (m.usage && m.usage.totalBytes > 0) {
    pushPoint(
      new Point("backup_datastore")
        .tag("datastore", m.datastore)
        .tag("namespace", m.namespace)
        .intField("total_bytes", m.usage.totalBytes)
        .intField("used_bytes", m.usage.usedBytes)
        .intField("avail_bytes", m.usage.availBytes)
        .floatField("used_pct", (m.usage.usedBytes / m.usage.totalBytes) * 100),
    );
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
    if (vm.lastSizeBytes !== null) point.intField("size_bytes", vm.lastSizeBytes);
    pushPoint(point);
  }
}
