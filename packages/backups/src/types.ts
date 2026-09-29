// Shapes shared by the rest-api poller/receiver, the alert rules and the
// web-admin /backups page. Two layers:
//   - BackupPollData: what the poller stores in backup_poll_state.data
//     (already filtered to our namespace, epoch seconds like Proxmox).
//   - BackupOverview / BackupVm: what computeBackupOverview() derives from it
//     plus the webhook events (ISO strings, ready for the UI).

import type { GuestDisk } from "./pve-config";
import type { GroupUsage, NamespaceUsage, PbsUsage, SnapshotUsage } from "./usage";

export type BackupStatus = "ok" | "warning" | "error" | "unknown";

/** Normalised Proxmox task/job result: "OK", "WARNINGS: n", an error text, or nothing yet. */
export type JobRunState = "ok" | "warning" | "error" | "unknown";

/** Last-contact bookkeeping per polled API (PBS, each PVE host). */
export interface SourceHealth {
  /** Last poll that succeeded (ISO). */
  okAt: string | null;
  /** Last poll attempt, successful or not (ISO). */
  attemptAt: string | null;
  /** Error of the last attempt, null when it succeeded. */
  error: string | null;
  /** First failed attempt of the current failure streak (ISO). */
  failingSince: string | null;
}

// --- PBS (already scoped to our datastore + namespace) ---

export interface PbsSnapshot {
  /** "vm" | "ct" | "host" */
  type: string;
  id: string;
  /** backup-time, epoch seconds */
  time: number;
  /** Logical size (sum of files), not the deduplicated size on disk. */
  sizeBytes: number | null;
  /** First line of the snapshot notes; PVE writes the guest name there by default. */
  comment: string | null;
  verification: "ok" | "failed" | null;
  protected: boolean;
  /** Listed by PBS but no manifest yet: the backup is still running (or died). Never counts as a backup. */
  unfinished?: boolean;
  /** Uploaded and only-here bytes. Missing until the usage pass ran, null for a backup still running. */
  usage?: SnapshotUsage | null;
}

export interface PbsJob {
  id: string;
  kind: "gc" | "verify" | "prune";
  state: JobRunState;
  /** Raw last-run-state, for the UI tooltip. */
  stateText: string | null;
  /** epoch seconds */
  lastRunAt: number | null;
  nextRunAt: number | null;
  schedule: string | null;
}

export interface PbsData {
  datastore: { totalBytes: number; usedBytes: number; availBytes: number } | null;
  snapshots: PbsSnapshot[];
  gc: PbsJob | null;
  /** Verify/prune jobs that cover our namespace (whole store or streamwizard). */
  verifyJobs: PbsJob[];
  pruneJobs: PbsJob[];
  /** Deduplicated sizes from the chunk indexes (docs/backup-sizes-plan.md). */
  usage?: PbsUsage | null;
}

// --- PVE (one per host) ---

export interface PveJob {
  id: string;
  enabled: boolean;
  schedule: string | null;
  /** PVE storage id that points at our datastore + namespace. */
  storage: string;
  selection: "list" | "all" | "pool";
  pool: string | null;
  /** Resolved guest ids. Empty for pool selections (not resolved in v1). */
  vmids: number[];
}

export interface PveGuest {
  vmid: number;
  name: string | null;
  type: "qemu" | "lxc";
  /** Only read for guests in our backup jobs. */
  disks?: GuestDisk[];
}

/** A vzdump task in the last 48 h that did not end OK and touched our guests. */
export interface PveFailedRun {
  upid: string;
  /** epoch seconds */
  startedAt: number;
  endedAt: number | null;
  status: string;
  /** Our guests the task log reports as failed. */
  failedVmids: number[];
  /** Our guests the task started a backup for. */
  coveredVmids: number[];
}

export interface PveHostData {
  node: string;
  jobs: PveJob[];
  guests: PveGuest[];
  failedRuns: PveFailedRun[];
}

export interface BackupPollData {
  version: 1;
  datastore: string;
  namespace: string;
  /** The poller's interval. Staleness checks scale with it; older rows lack it (5 min). */
  pollSeconds?: number;
  pbs: { health: SourceHealth; data: PbsData | null };
  /** Keyed by the configured host name (e.g. "pve1"). */
  pve: Record<string, { health: SourceHealth; data: PveHostData | null }>;
}

// --- Webhook events (backup_events rows, trimmed) ---

export interface BackupEventGuest {
  vmid: number;
  name: string | null;
  status: "ok" | "failed";
}

export interface BackupEventLite {
  id: string;
  source: string;
  eventType: string;
  jobId: string | null;
  severity: string;
  title: string;
  occurredAt: string;
  receivedAt: string;
  guests: BackupEventGuest[] | null;
}

// --- Derived overview (API + UI) ---

export interface BackupCheck {
  id: string;
  label: string;
  status: BackupStatus;
  hint: string;
}

export interface BackupJobView {
  id: string;
  kind: PbsJob["kind"];
  state: JobRunState;
  stateText: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  status: BackupStatus;
}

export interface BackupHostView {
  name: string;
  status: BackupStatus;
  reasons: string[];
  health: SourceHealth;
  lastEventAt: string | null;
  jobs: { id: string; enabled: boolean; schedule: string | null; vmids: number[]; selection: PveJob["selection"] }[];
}

export type BackupVmIssueCode =
  | "no_backups"
  | "stale"
  | "verify_failed"
  | "verify_pending"
  | "few_snapshots"
  | "run_failed"
  | "webhook_mismatch"
  | "job_disabled"
  | "not_in_job";

export interface BackupVmIssue {
  code: BackupVmIssueCode;
  status: BackupStatus;
  message: string;
}

export interface BackupVm {
  vmid: number;
  type: string;
  name: string | null;
  host: string | null;
  status: BackupStatus;
  /** Human-readable, for the UI. Includes staleness notes that aren't issues. */
  reasons: string[];
  /** Structured problems, for alert rules. */
  issues: BackupVmIssue[];
  lastSuccessAt: string | null;
  ageSeconds: number | null;
  snapshotCount: number;
  /** Configured size of the disks vzdump backs up (PVE config). */
  diskBytes: number | null;
  disks: GuestDisk[] | null;
  /** Newest snapshot: bytes the backup run sent to PBS (compressed). */
  lastUploadedBytes: number | null;
  /** Deduplicated usage of all kept snapshots; null until the usage pass ran. */
  usage: GroupUsage | null;
  verification: "ok" | "failed" | "pending" | "none";
  lastEvent: { at: string; status: "ok" | "failed"; source: string } | null;
}

export interface BackupOverview {
  status: BackupStatus;
  generatedAt: string;
  datastore: string;
  namespace: string;
  checks: BackupCheck[];
  pbs: { health: SourceHealth; stale: boolean };
  /** Poll interval the checks were computed with. */
  pollSeconds: number;
  usage: { totalBytes: number; usedBytes: number; availBytes: number; usedPct: number } | null;
  /** Deduplicated usage of our namespace only (no homelab numbers). */
  namespaceUsage: NamespaceUsage | null;
  jobs: { gc: BackupJobView | null; verify: BackupJobView[]; prune: BackupJobView[] };
  hosts: BackupHostView[];
  vms: BackupVm[];
}

/** GET /internal/backups */
export interface BackupOverviewResponse extends BackupOverview {
  recentEvents: BackupEventLite[];
}

export interface BackupEventDetail extends BackupEventLite {
  message: string;
  fields: Record<string, string>;
}

/** GET /internal/backups/vms/:vmid */
export interface BackupVmDetailResponse {
  vm: BackupVm;
  snapshots: PbsSnapshot[];
  events: BackupEventDetail[];
  pbsStale: boolean;
}

/** GET /internal/backups/events */
export interface BackupEventsResponse {
  events: BackupEventDetail[];
  nextBefore: string | null;
}
