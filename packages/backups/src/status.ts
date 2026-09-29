// One status per VM and for the backup setup as a whole, from the polled
// state (PBS + PVE) and the stored webhook events. Pure: rest-api serves it,
// the alert rules evaluate it, tests pin it.
//
// Ground rules:
//   - PBS snapshots are the source of truth for "last successful backup".
//   - Events and PVE task logs can only make a VM look worse, never better.
//   - Stale data never reads as healthy: a VM that would be "ok" on data we
//     couldn't refresh is "unknown". Worse states stay, because an age computed
//     from old data is still a lower bound.

import { BACKUP_THRESHOLDS, DEFAULT_POLL_SECONDS, effectiveThresholds, type BackupThresholds } from "./thresholds";
import type {
  BackupCheck,
  BackupEventLite,
  BackupHostView,
  BackupJobView,
  BackupOverview,
  BackupPollData,
  BackupStatus,
  BackupVm,
  BackupVmIssue,
  BackupVmIssueCode,
  PbsJob,
  PbsSnapshot,
  SourceHealth,
} from "./types";

const RANK: Record<BackupStatus, number> = { ok: 0, unknown: 1, warning: 2, error: 3 };

export function worstStatus(statuses: BackupStatus[]): BackupStatus {
  return statuses.reduce<BackupStatus>((worst, s) => (RANK[s] > RANK[worst] ? s : worst), "ok");
}

const HOUR = 3600;
const EMPTY_HEALTH: SourceHealth = { okAt: null, attemptAt: null, error: null, failingSince: null };

const iso = (epochSeconds: number | null) => (epochSeconds === null ? null : new Date(epochSeconds * 1000).toISOString());
const seconds = (isoTime: string) => Date.parse(isoTime) / 1000;

function hoursText(sec: number): string {
  const h = sec / HOUR;
  return h >= 48 ? `${Math.floor(h / 24)} d` : `${Math.floor(h)} h`;
}

function timeText(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function isSourceStale(health: SourceHealth | undefined, nowSec: number, t: BackupThresholds): boolean {
  if (!health?.okAt) return true;
  return nowSec - seconds(health.okAt) > t.sourceStaleMinutes * 60;
}

interface VmContext {
  host: string;
  jobId: string;
  enabled: boolean;
}

function jobView(job: PbsJob, maxAgeSec: number, overdueStatus: BackupStatus, nowSec: number, stale: boolean): BackupJobView {
  let status: BackupStatus = "ok";
  if (job.state === "error") status = "error";
  else if (job.lastRunAt === null) status = "unknown";
  else if (nowSec - job.lastRunAt > maxAgeSec) status = overdueStatus;
  else if (job.state === "warning") status = "warning";
  if (stale && status === "ok") status = "unknown";
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    stateText: job.stateText,
    lastRunAt: iso(job.lastRunAt),
    nextRunAt: iso(job.nextRunAt),
    status,
  };
}

function jobHint(job: BackupJobView, label: string): string {
  if (job.state === "error") return `${label} failed: ${job.stateText ?? "unknown error"}`;
  if (!job.lastRunAt) return `${label} has not run yet`;
  return `${label} last ran ${job.lastRunAt.replace("T", " ").slice(0, 16)} UTC (${job.stateText ?? "no result"})`;
}

export function computeBackupOverview(
  poll: BackupPollData | null,
  events: BackupEventLite[],
  now: Date = new Date(),
  thresholds: BackupThresholds = BACKUP_THRESHOLDS,
): BackupOverview {
  const pollSeconds = poll?.pollSeconds ?? DEFAULT_POLL_SECONDS;
  const t = effectiveThresholds(thresholds, pollSeconds);
  const nowSec = now.getTime() / 1000;
  const pbsHealth = poll?.pbs.health ?? EMPTY_HEALTH;
  const pbsStale = isSourceStale(pbsHealth, nowSec, t);
  const pbs = poll?.pbs.data ?? null;
  const hostEntries = Object.entries(poll?.pve ?? {});

  // --- Index guests, jobs, failed runs, events by VMID ---
  const snapshotsByVm = new Map<number, PbsSnapshot[]>();
  for (const snap of pbs?.snapshots ?? []) {
    if (snap.type !== "vm" && snap.type !== "ct") continue;
    const vmid = Number(snap.id);
    if (!Number.isInteger(vmid)) continue;
    const list = snapshotsByVm.get(vmid) ?? [];
    list.push(snap);
    snapshotsByVm.set(vmid, list);
  }

  const jobsByVm = new Map<number, VmContext[]>();
  const nameByVm = new Map<number, string>();
  const hostStale = new Map<string, boolean>();
  let unresolvedSelection = false;
  let everyHostPolled = hostEntries.length > 0;
  for (const [host, entry] of hostEntries) {
    hostStale.set(host, isSourceStale(entry.health, nowSec, t));
    if (!entry.data) {
      everyHostPolled = false;
      continue;
    }
    // Only names of guests this host actually backs up into our namespace:
    // VMIDs are per host, so another host's VM 100 (homelab) must not lend
    // its name to ours.
    const jobVmids = new Set(entry.data.jobs.flatMap((j) => j.vmids));
    for (const guest of entry.data.guests) if (guest.name && jobVmids.has(guest.vmid)) nameByVm.set(guest.vmid, guest.name);
    for (const job of entry.data.jobs) {
      if (job.selection === "pool") unresolvedSelection = true;
      for (const vmid of job.vmids) {
        const list = jobsByVm.get(vmid) ?? [];
        list.push({ host, jobId: job.id, enabled: job.enabled });
        jobsByVm.set(vmid, list);
      }
    }
  }

  const sortedEvents = [...events].sort((a, b) => seconds(b.occurredAt) - seconds(a.occurredAt));
  const lastEventByVm = new Map<number, { event: BackupEventLite; status: "ok" | "failed" }>();
  const lastEventByHost = new Map<string, string>();
  for (const event of sortedEvents) {
    if (!lastEventByHost.has(event.source)) lastEventByHost.set(event.source, event.occurredAt);
    if (event.eventType !== "vzdump") continue;
    for (const guest of event.guests ?? []) {
      if (!lastEventByVm.has(guest.vmid)) lastEventByVm.set(guest.vmid, { event, status: guest.status });
    }
  }

  const vmids = new Set<number>([...snapshotsByVm.keys(), ...jobsByVm.keys(), ...lastEventByVm.keys()]);

  // --- Per VM ---
  const vms: BackupVm[] = [...vmids].map((vmid) => {
    const snaps = (snapshotsByVm.get(vmid) ?? []).sort((a, b) => b.time - a.time);
    const newest = snaps[0] ?? null;
    const jobs = jobsByVm.get(vmid) ?? [];
    const lastEvent = lastEventByVm.get(vmid) ?? null;
    const host = jobs[0]?.host ?? lastEvent?.event.source ?? null;

    let status: BackupStatus = "ok";
    const reasons: string[] = [];
    const issues: BackupVmIssue[] = [];
    const bump = (s: BackupStatus, code: BackupVmIssueCode, reason: string) => {
      status = worstStatus([status, s]);
      reasons.push(reason);
      issues.push({ code, status: s, message: reason });
    };

    const age = newest ? nowSec - newest.time : null;
    if (!newest) {
      bump("warning", "no_backups", "No backups in PBS yet");
    } else {
      if (age! > t.staleCritHours * HOUR) bump("error", "stale", `Newest backup is ${hoursText(age!)} old`);
      else if (age! > t.staleWarnHours * HOUR) bump("warning", "stale", `Newest backup is ${hoursText(age!)} old`);

      if (newest.verification === "failed") bump("error", "verify_failed", "Newest backup failed verification");
      const olderFailed = snaps.slice(1).filter((s) => s.verification === "failed").length;
      if (olderFailed > 0) bump("error", "verify_failed", `${olderFailed} older snapshot${olderFailed === 1 ? "" : "s"} failed verification`);
      if (newest.verification === null && age! > t.verifyPendingWarnHours * HOUR) {
        bump("warning", "verify_pending", `Newest backup not verified after ${t.verifyPendingWarnHours} h`);
      }
      if (snaps.length < t.minSnapshots) bump("warning", "few_snapshots", `Only ${snaps.length} snapshot${snaps.length === 1 ? "" : "s"} (expected ${t.minSnapshots}+)`);
    }

    if (lastEvent) {
      const at = seconds(lastEvent.event.occurredAt);
      if (lastEvent.status === "failed" && (!newest || at > newest.time)) {
        bump("error", "run_failed", `Backup failed on ${lastEvent.event.source} at ${timeText(at)}`);
      }
      const pbsPolledAfter = pbsHealth.okAt !== null && seconds(pbsHealth.okAt) > at;
      if (lastEvent.status === "ok" && pbsPolledAfter && (!newest || newest.time < at - 24 * HOUR)) {
        bump("warning", "webhook_mismatch", `${lastEvent.event.source} reported success at ${timeText(at)}, but PBS has no matching snapshot`);
      }
    }

    for (const [hostName, entry] of hostEntries) {
      for (const run of entry.data?.failedRuns ?? []) {
        if (run.failedVmids.includes(vmid) && (!newest || run.startedAt > newest.time)) {
          bump("error", "run_failed", `Backup task failed on ${hostName} at ${timeText(run.startedAt)}`);
        }
      }
    }

    if (jobs.length > 0 && jobs.every((j) => !j.enabled)) {
      bump("error", "job_disabled", `Backup job ${jobs.map((j) => j.jobId).join(", ")} is disabled`);
    }
    if (jobs.length === 0 && everyHostPolled && !unresolvedSelection && newest) {
      bump("warning", "not_in_job", "Not in any backup job for this namespace");
    }

    if (pbsStale) reasons.push("PBS data is not current");
    if (host && hostStale.get(host)) reasons.push(`${host} API is not reachable`);
    if (status === "ok" && (pbsStale || (host && hostStale.get(host)))) status = "unknown";

    const verification: BackupVm["verification"] = !newest
      ? "none"
      : newest.verification ?? (age! <= t.verifyPendingWarnHours * HOUR ? "pending" : "none");

    return {
      vmid,
      type: newest?.type ?? "vm",
      name: nameByVm.get(vmid) ?? newest?.comment ?? lastEvent?.event.guests?.find((g) => g.vmid === vmid)?.name ?? null,
      host,
      status,
      reasons,
      issues,
      lastSuccessAt: newest ? iso(newest.time) : null,
      ageSeconds: age === null ? null : Math.round(age),
      snapshotCount: snaps.length,
      lastSizeBytes: newest?.sizeBytes ?? null,
      verification,
      lastEvent: lastEvent ? { at: lastEvent.event.occurredAt, status: lastEvent.status, source: lastEvent.event.source } : null,
    };
  });
  vms.sort((a, b) => RANK[b.status] - RANK[a.status] || a.vmid - b.vmid);

  // --- Checks ---
  const checks: BackupCheck[] = [];

  checks.push(
    pbsStale
      ? {
          id: "pbs-poll",
          label: "PBS reachable",
          status: "error",
          hint: pbsHealth.okAt
            ? `No successful poll since ${pbsHealth.okAt.replace("T", " ").slice(0, 16)} UTC${pbsHealth.error ? `: ${pbsHealth.error}` : ""}`
            : `Never polled successfully${pbsHealth.error ? `: ${pbsHealth.error}` : ""}`,
        }
      : {
          id: "pbs-poll",
          label: "PBS reachable",
          status: "ok",
          hint: `Last polled ${pbsHealth.okAt!.replace("T", " ").slice(0, 16)} UTC`,
        },
  );

  const usage = pbs?.datastore
    ? { ...pbs.datastore, usedPct: pbs.datastore.totalBytes > 0 ? (pbs.datastore.usedBytes / pbs.datastore.totalBytes) * 100 : 0 }
    : null;
  if (!usage) {
    checks.push({ id: "datastore-usage", label: "Datastore space", status: "unknown", hint: "No usage data yet" });
  } else {
    const pct = usage.usedPct;
    const s: BackupStatus = pct >= t.datastoreCritPct ? "error" : pct >= t.datastoreWarnPct ? "warning" : pbsStale ? "unknown" : "ok";
    checks.push({ id: "datastore-usage", label: "Datastore space", status: s, hint: `${pct.toFixed(1)} % used` });
  }

  const gc = pbs?.gc ? jobView(pbs.gc, t.pbsJobMaxAgeHours * HOUR, "error", nowSec, pbsStale) : null;
  checks.push(gc ? { id: "gc", label: "Garbage collection", status: gc.status, hint: jobHint(gc, "GC") } : { id: "gc", label: "Garbage collection", status: "unknown", hint: "No GC status yet" });

  const prune = (pbs?.pruneJobs ?? []).map((j) => jobView(j, t.pbsJobMaxAgeHours * HOUR, "error", nowSec, pbsStale));
  const verify = (pbs?.verifyJobs ?? []).map((j) => jobView(j, t.reverifyMaxAgeDays * 24 * HOUR, "warning", nowSec, pbsStale));
  if (pbs) {
    if (prune.length === 0) checks.push({ id: "prune", label: "Prune job", status: "warning", hint: "No prune job covers this namespace" });
    for (const job of prune) checks.push({ id: `prune:${job.id}`, label: `Prune job ${job.id}`, status: job.status, hint: jobHint(job, "Prune") });
    if (verify.length === 0) checks.push({ id: "verify", label: "Verify job", status: "warning", hint: "No verify job covers this namespace" });
    for (const job of verify) checks.push({ id: `verify:${job.id}`, label: `Verify job ${job.id}`, status: job.status, hint: jobHint(job, "Verify") });
  }

  const hosts: BackupHostView[] = hostEntries.map(([name, entry]) => {
    const stale = hostStale.get(name) ?? true;
    const lastEventAt = lastEventByHost.get(name) ?? null;
    const reasons: string[] = [];
    let status: BackupStatus = "ok";
    if (stale) {
      status = "error";
      reasons.push(entry.health.error ? `API not reachable: ${entry.health.error}` : "API not reachable");
    }
    const jobs = entry.data?.jobs ?? [];
    if (entry.data && jobs.length === 0) {
      status = worstStatus([status, "warning"]);
      reasons.push("No backup job writes to this namespace");
    }
    if (jobs.length > 0 && (!lastEventAt || nowSec - seconds(lastEventAt) > t.hostQuietHours * HOUR)) {
      status = worstStatus([status, "warning"]);
      reasons.push(lastEventAt ? `No webhook in ${t.hostQuietHours} h` : "No webhook received yet");
    }
    return {
      name,
      status,
      reasons,
      health: entry.health,
      lastEventAt,
      jobs: jobs.map((j) => ({ id: j.id, enabled: j.enabled, schedule: j.schedule, vmids: j.vmids, selection: j.selection })),
    };
  });
  for (const host of hosts) {
    checks.push({ id: `host:${host.name}`, label: host.name, status: host.status, hint: host.reasons.join("; ") || "API reachable, webhooks arriving" });
  }

  const vmStatus = worstStatus(vms.map((v) => v.status));
  const okCount = vms.filter((v) => v.status === "ok").length;
  checks.push({
    id: "vms",
    label: "VM backups",
    status: vms.length === 0 ? "unknown" : vmStatus,
    hint: vms.length === 0 ? "No VMs found yet" : `${okCount} of ${vms.length} VMs OK`,
  });

  return {
    status: worstStatus(checks.map((c) => c.status)),
    generatedAt: now.toISOString(),
    datastore: poll?.datastore ?? "",
    namespace: poll?.namespace ?? "",
    checks,
    pbs: { health: pbsHealth, stale: pbsStale },
    pollSeconds,
    usage,
    jobs: { gc, verify, prune },
    hosts,
    vms,
  };
}
