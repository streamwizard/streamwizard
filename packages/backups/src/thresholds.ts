// Code defaults for backup health (confirmed 2026-09-28, docs/backup-monitoring-plan.md).
// The alert rules re-export these through @repo/alerting/thresholds so the
// /backups page and /alerts agree; per-rule overrides live in alert_rule_config.

export interface BackupThresholds {
  /** Newest snapshot older than this → warning. One daily run plus slack. */
  staleWarnHours: number;
  /** Newest snapshot older than this → error. Two missed daily runs. */
  staleCritHours: number;
  /** Newest snapshot still unverified this long after the backup → warning. */
  verifyPendingWarnHours: number;
  /** Fewer snapshots than this → warning (prune keeps last 3 + dailies). */
  minSnapshots: number;
  datastoreWarnPct: number;
  datastoreCritPct: number;
  /** GC and prune run daily; no run for this long → error. */
  pbsJobMaxAgeHours: number;
  /** The re-verify job runs monthly; no run for this long → warning. */
  reverifyMaxAgeDays: number;
  /** An API not polled successfully for this long → error, its data unknown. */
  sourceStaleMinutes: number;
  /** A host with backup jobs sent no webhook for this long → warning. */
  hostQuietHours: number;
}

export const BACKUP_THRESHOLDS: BackupThresholds = {
  staleWarnHours: 26,
  staleCritHours: 50,
  verifyPendingWarnHours: 6,
  minSnapshots: 3,
  datastoreWarnPct: 80,
  datastoreCritPct: 90,
  pbsJobMaxAgeHours: 48,
  reverifyMaxAgeDays: 33,
  sourceStaleMinutes: 15,
  hostQuietHours: 26,
};
