// Pure pieces of the Proxmox webhook receiver: which events are ours, and
// the per-guest result parsed out of the vzdump notification text.
//
// Proxmox hands webhooks only the rendered text (title/message), never the
// structured guest table, so the parser reads the default vzdump body:
//
//   VMID  Name       Status  Time     Size       Filename
//   100   pfsense    ok      1min 2s  1.2 GiB    vm/100/2026-09-28T01:00:02Z
//   102   mc-node-1  err     3s       0 B        null
//
// and falls back to the log lines ("ERROR: Backup of VM 102 failed").

import type { BackupEventGuest, BackupPollData } from "./types";

export type EventOwnership = "ours" | "not-ours" | "unknown";

export interface WebhookEventKey {
  source: string;
  type: string;
  jobId: string | null;
  datastore: string | null;
}

/**
 * Does this event belong to our namespace? "unknown" means job discovery
 * hasn't succeeded for that source yet: the receiver keeps the event
 * unmatched and the next poll decides.
 */
export function classifyEvent(poll: BackupPollData | null, event: WebhookEventKey): EventOwnership {
  switch (event.type) {
    case "vzdump": {
      if (!poll) return "unknown";
      if (!(event.source in poll.pve)) return "not-ours";
      const host = poll.pve[event.source]!.data;
      if (!host) return "unknown";
      // Manual "Backup now" runs carry no job id; only scheduled jobs count.
      return event.jobId && host.jobs.some((j) => j.id === event.jobId) ? "ours" : "not-ours";
    }
    case "gc":
      if (!poll) return "unknown";
      return event.datastore === poll.datastore ? "ours" : "not-ours";
    case "verify":
    case "prune": {
      if (!poll) return "unknown";
      if (event.datastore !== poll.datastore) return "not-ours";
      const pbs = poll.pbs.data;
      if (!pbs) return "unknown";
      const jobs = event.type === "verify" ? pbs.verifyJobs : pbs.pruneJobs;
      return event.jobId && jobs.some((j) => j.id === event.jobId) ? "ours" : "not-ours";
    }
    default:
      return "not-ours";
  }
}

const TABLE_ROW_RE = /^\s*(\d+)\s+(\S+)\s+(ok|err|error|failed)\b/i;
const HEADER_RE = /^\s*VMID\s+Name\s+Status\b/i;
const LOG_FINISHED_RE = /INFO: Finished Backup of VM (\d+)/;
const LOG_FAILED_RE = /ERROR: Backup of VM (\d+) failed/;

/** Per-guest result from a vzdump notification body, or null if nothing parsed. */
export function parseVzdumpGuests(message: string): BackupEventGuest[] | null {
  const lines = message.split(/\r?\n/);

  const headerIndex = lines.findIndex((l) => HEADER_RE.test(l));
  if (headerIndex !== -1) {
    const guests: BackupEventGuest[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
      if (!line.trim()) {
        if (guests.length) break;
        continue;
      }
      const m = TABLE_ROW_RE.exec(line);
      if (!m) {
        if (guests.length) break;
        continue;
      }
      guests.push({ vmid: Number(m[1]), name: m[2] ?? null, status: m[3]!.toLowerCase() === "ok" ? "ok" : "failed" });
    }
    if (guests.length) return guests;
  }

  const byVm = new Map<number, BackupEventGuest>();
  for (const line of lines) {
    const failed = LOG_FAILED_RE.exec(line);
    if (failed) byVm.set(Number(failed[1]), { vmid: Number(failed[1]), name: null, status: "failed" });
    const finished = LOG_FINISHED_RE.exec(line);
    if (finished && !byVm.has(Number(finished[1]))) byVm.set(Number(finished[1]), { vmid: Number(finished[1]), name: null, status: "ok" });
  }
  return byVm.size ? [...byVm.values()].sort((a, b) => a.vmid - b.vmid) : null;
}

/**
 * When the text didn't parse, attribute the job-level result to every guest
 * of the job, so a failed run still shows on the right VMs.
 */
export function jobLevelGuests(poll: BackupPollData | null, source: string, jobId: string | null, severity: string): BackupEventGuest[] | null {
  const job = jobId ? poll?.pve[source]?.data?.jobs.find((j) => j.id === jobId) : undefined;
  if (!job || job.vmids.length === 0) return null;
  const status = severity === "error" ? "failed" : "ok";
  return job.vmids.map((vmid) => ({ vmid, name: null, status }));
}
