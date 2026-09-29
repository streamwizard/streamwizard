// Pure helpers that turn raw PBS / PVE API responses into BackupPollData
// pieces. Kept free of I/O so the namespace filtering, which is what keeps
// other namespaces out of our data, is covered by unit tests.

import type { JobRunState, PbsJob, PbsSnapshot, PveFailedRun, PveGuest, PveJob } from "./types";

// --- Raw API shapes (only the fields we read) ---

export interface RawPbsSnapshot {
  "backup-type": string;
  "backup-id": string;
  "backup-time": number;
  size?: number;
  /** Archive files of the snapshot; `size` is absent for client.log.blob. */
  files?: { filename: string; size?: number }[];
  comment?: string;
  protected?: boolean;
  verification?: { state?: string; upid?: string };
}

export interface RawPbsDatastoreStatus {
  total?: number;
  used?: number;
  avail?: number;
}

export interface RawPbsGcStatus {
  "last-run-state"?: string;
  "last-run-endtime"?: number;
  "next-run"?: number;
  schedule?: string;
}

export interface RawPbsJob {
  id: string;
  store?: string;
  ns?: string;
  schedule?: string;
  disable?: boolean;
  "last-run-state"?: string;
  "last-run-endtime"?: number;
  "next-run"?: number;
}

export interface RawPveStorage {
  storage: string;
  type: string;
  datastore?: string;
  namespace?: string;
  disable?: number | boolean;
}

export interface RawPveBackupJob {
  id: string;
  storage?: string;
  node?: string;
  enabled?: number | boolean;
  schedule?: string;
  vmid?: string;
  all?: number | boolean;
  exclude?: string;
  pool?: string;
}

export interface RawPveGuest {
  vmid: number | string;
  name?: string;
  template?: number | boolean;
}

export interface RawPveTask {
  upid: string;
  type: string;
  starttime: number;
  endtime?: number;
  status?: string;
}

// --- PBS ---

/** Proxmox writes "OK", "WARNINGS: <n>", or the error text into last-run-state. */
export function jobRunState(text: string | undefined | null): JobRunState {
  if (!text) return "unknown";
  if (text === "OK") return "ok";
  if (text.startsWith("WARNINGS")) return "warning";
  return "error";
}

/**
 * Does a verify/prune job with this `ns` touch our namespace? No ns means the
 * whole datastore. max-depth is ignored: our namespace sits directly under
 * the root, and a job that stops above it would be a misconfiguration we'd
 * rather show than hide.
 */
export function jobCoversNamespace(jobNs: string | undefined, namespace: string): boolean {
  if (!jobNs) return true;
  return jobNs === namespace || namespace.startsWith(`${jobNs}/`);
}

export function toPbsSnapshots(raw: RawPbsSnapshot[]): PbsSnapshot[] {
  return raw.map((s) => ({
    type: s["backup-type"],
    id: s["backup-id"],
    time: s["backup-time"],
    sizeBytes: typeof s.size === "number" ? s.size : null,
    comment: s.comment?.split("\n")[0]?.trim() || null,
    verification: s.verification?.state === "ok" ? "ok" : s.verification?.state === "failed" ? "failed" : null,
    protected: Boolean(s.protected),
    // A finished snapshot always has its manifest; a running one doesn't yet.
    ...(s.files && !s.files.some((f) => f.filename === "index.json.blob") ? { unfinished: true } : {}),
  }));
}

export function toPbsJobs(raw: RawPbsJob[], kind: "verify" | "prune", datastore: string, namespace: string): PbsJob[] {
  return raw
    .filter((j) => (j.store ?? datastore) === datastore && jobCoversNamespace(j.ns, namespace) && !j.disable)
    .map((j) => ({
      id: j.id,
      kind,
      state: jobRunState(j["last-run-state"]),
      stateText: j["last-run-state"] ?? null,
      lastRunAt: j["last-run-endtime"] ?? null,
      nextRunAt: j["next-run"] ?? null,
      schedule: j.schedule ?? null,
    }));
}

export function toPbsGc(raw: RawPbsGcStatus | null, datastore: string): PbsJob | null {
  if (!raw) return null;
  return {
    id: datastore,
    kind: "gc",
    state: jobRunState(raw["last-run-state"]),
    stateText: raw["last-run-state"] ?? null,
    lastRunAt: raw["last-run-endtime"] ?? null,
    nextRunAt: raw["next-run"] ?? null,
    schedule: raw.schedule ?? null,
  };
}

export function toDatastoreUsage(raw: RawPbsDatastoreStatus | null) {
  if (!raw || typeof raw.total !== "number" || typeof raw.used !== "number") return null;
  return { totalBytes: raw.total, usedBytes: raw.used, availBytes: raw.avail ?? raw.total - raw.used };
}

// --- PVE ---

const truthy = (v: number | boolean | undefined) => v === true || v === 1;

/** PVE storage ids (type pbs) that write into our datastore + namespace. */
export function findOurStorages(raw: RawPveStorage[], datastore: string, namespace: string): string[] {
  return raw
    .filter((s) => s.type === "pbs" && s.datastore === datastore && (s.namespace ?? "") === namespace && !truthy(s.disable))
    .map((s) => s.storage);
}

export function toPveGuests(qemu: RawPveGuest[], lxc: RawPveGuest[]): PveGuest[] {
  const map = (rows: RawPveGuest[], type: PveGuest["type"]) =>
    rows.filter((g) => !truthy(g.template)).map((g) => ({ vmid: Number(g.vmid), name: g.name ?? null, type }));
  return [...map(qemu, "qemu"), ...map(lxc, "lxc")].sort((a, b) => a.vmid - b.vmid);
}

function parseIdList(list: string | undefined): number[] {
  if (!list) return [];
  return list
    .split(/[,\s]+/)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
}

/**
 * Backup jobs on this node that target one of our storages. PVE leaves
 * `enabled` out when the job is on, and `node` out when it runs everywhere.
 */
export function toPveJobs(raw: RawPveBackupJob[], ourStorages: string[], node: string, guests: PveGuest[]): PveJob[] {
  return raw
    .filter((j) => j.storage && ourStorages.includes(j.storage) && (!j.node || j.node === node))
    .map((j) => {
      const enabled = j.enabled === undefined ? true : truthy(j.enabled);
      if (truthy(j.all)) {
        const excluded = new Set(parseIdList(j.exclude));
        return {
          id: j.id,
          enabled,
          schedule: j.schedule ?? null,
          storage: j.storage!,
          selection: "all" as const,
          pool: null,
          vmids: guests.map((g) => g.vmid).filter((id) => !excluded.has(id)),
        };
      }
      if (j.pool) {
        return { id: j.id, enabled, schedule: j.schedule ?? null, storage: j.storage!, selection: "pool" as const, pool: j.pool, vmids: [] };
      }
      return {
        id: j.id,
        enabled,
        schedule: j.schedule ?? null,
        storage: j.storage!,
        selection: "list" as const,
        pool: null,
        vmids: parseIdList(j.vmid),
      };
    });
}

const STARTED_RE = /INFO: Starting Backup of VM (\d+)/;
const FAILED_RE = /ERROR: Backup of VM (\d+) failed/;

/**
 * Which of our guests a vzdump task log covered and failed. A task that
 * touched none of our guests (a homelab job on the same host) returns null
 * and is dropped, so its details never leave the poller.
 */
export function toPveFailedRun(task: RawPveTask, logLines: string[], ourVmids: Set<number>): PveFailedRun | null {
  const covered = new Set<number>();
  const failed = new Set<number>();
  for (const line of logLines) {
    const started = STARTED_RE.exec(line);
    if (started) covered.add(Number(started[1]));
    const fail = FAILED_RE.exec(line);
    if (fail) failed.add(Number(fail[1]));
  }
  const coveredVmids = [...covered].filter((id) => ourVmids.has(id)).sort((a, b) => a - b);
  const failedVmids = [...failed].filter((id) => ourVmids.has(id)).sort((a, b) => a - b);
  if (coveredVmids.length === 0 && failedVmids.length === 0) return null;
  return {
    upid: task.upid,
    startedAt: task.starttime,
    endedAt: task.endtime ?? null,
    status: task.status ?? "unknown",
    failedVmids,
    coveredVmids,
  };
}
