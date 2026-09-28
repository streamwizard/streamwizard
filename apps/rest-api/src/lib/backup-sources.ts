import {
  findOurStorages,
  toDatastoreUsage,
  toPbsGc,
  toPbsJobs,
  toPbsSnapshots,
  toPveFailedRun,
  toPveGuests,
  toPveJobs,
  type PbsData,
  type PveFailedRun,
  type PveHostData,
  type RawPbsDatastoreStatus,
  type RawPbsGcStatus,
  type RawPbsJob,
  type RawPbsSnapshot,
  type RawPveBackupJob,
  type RawPveGuest,
  type RawPveStorage,
  type RawPveTask,
} from "@repo/backups";
import type { ProxmoxClient } from "./proxmox-client";

/** How far back the PVE task list is read for failed vzdump runs. */
const FAILED_RUN_WINDOW_SECONDS = 48 * 3600;

export interface SourceResult<T> {
  data: T;
  /** Parts that failed while the source as a whole answered. */
  warnings: string[];
}

const message = (error: unknown) => (error as Error).message;

/**
 * One PBS pass. The snapshot list is required, and is always requested with
 * our namespace. The other endpoints are best effort: a failure keeps the
 * previous value and is reported as a warning.
 */
export async function fetchPbs(
  client: ProxmoxClient,
  datastore: string,
  namespace: string,
  prev: PbsData | null,
): Promise<SourceResult<PbsData>> {
  const store = encodeURIComponent(datastore);
  const [snapshots, status, gc, verify, prune] = await Promise.allSettled([
    client.get<RawPbsSnapshot[]>(`/admin/datastore/${store}/snapshots`, { ns: namespace }),
    client.get<RawPbsDatastoreStatus>(`/admin/datastore/${store}/status`),
    client.get<RawPbsGcStatus>(`/admin/datastore/${store}/gc`),
    client.get<RawPbsJob[]>("/admin/verify", { store: datastore }),
    client.get<RawPbsJob[]>("/admin/prune", { store: datastore }),
  ]);

  if (snapshots.status === "rejected") throw snapshots.reason;

  const warnings: string[] = [];
  const pick = <R, V>(result: PromiseSettledResult<R>, map: (value: R) => V, fallback: V): V => {
    if (result.status === "fulfilled") return map(result.value);
    warnings.push(message(result.reason));
    return fallback;
  };

  return {
    data: {
      snapshots: toPbsSnapshots(snapshots.value),
      datastore: pick(status, toDatastoreUsage, prev?.datastore ?? null),
      gc: pick(gc, (raw) => toPbsGc(raw, datastore), prev?.gc ?? null),
      verifyJobs: pick(verify, (raw) => toPbsJobs(raw, "verify", datastore, namespace), prev?.verifyJobs ?? []),
      pruneJobs: pick(prune, (raw) => toPbsJobs(raw, "prune", datastore, namespace), prev?.pruneJobs ?? []),
    },
    warnings,
  };
}

/**
 * One PVE host pass: discover the jobs that write to our namespace, resolve
 * their guests, and read the logs of recent vzdump tasks that did not end OK.
 * Task logs are fetched once per task; later passes reuse the parsed result.
 */
export async function fetchPve(
  client: ProxmoxClient,
  datastore: string,
  namespace: string,
  prev: PveHostData | null,
  nowSeconds: number,
): Promise<SourceResult<PveHostData>> {
  const nodes = await client.get<{ node: string }[]>("/nodes");
  // The hosts are standalone, so the node list has exactly one entry.
  const node = nodes[0]?.node;
  if (!node) throw new Error("PVE /nodes returned no node");
  const nodePath = `/nodes/${encodeURIComponent(node)}`;

  const [storages, jobs, qemu, lxc] = await Promise.all([
    client.get<RawPveStorage[]>("/storage"),
    client.get<RawPveBackupJob[]>("/cluster/backup"),
    client.get<RawPveGuest[]>(`${nodePath}/qemu`),
    client.get<RawPveGuest[]>(`${nodePath}/lxc`),
  ]);

  const guests = toPveGuests(qemu, lxc);
  const ourJobs = toPveJobs(jobs, findOurStorages(storages, datastore, namespace), node, guests);
  const ourVmids = new Set(ourJobs.flatMap((j) => j.vmids));

  const warnings: string[] = [];
  let failedRuns: PveFailedRun[] = [];
  try {
    failedRuns = await readFailedRuns(client, nodePath, ourVmids, prev?.failedRuns ?? [], nowSeconds);
  } catch (error) {
    warnings.push(message(error));
    failedRuns = (prev?.failedRuns ?? []).filter((r) => r.startedAt >= nowSeconds - FAILED_RUN_WINDOW_SECONDS);
  }

  return { data: { node, jobs: ourJobs, guests, failedRuns }, warnings };
}

async function readFailedRuns(
  client: ProxmoxClient,
  nodePath: string,
  ourVmids: Set<number>,
  prevRuns: PveFailedRun[],
  nowSeconds: number,
): Promise<PveFailedRun[]> {
  if (ourVmids.size === 0) return [];
  const tasks = await client.get<RawPveTask[]>(`${nodePath}/tasks`, {
    typefilter: "vzdump",
    since: Math.floor(nowSeconds - FAILED_RUN_WINDOW_SECONDS),
    limit: 200,
  });

  const known = new Map(prevRuns.map((r) => [r.upid, r]));
  const runs: PveFailedRun[] = [];
  for (const task of tasks) {
    // Still running, finished OK, or only warnings: nothing to attribute.
    if (!task.endtime || !task.status || task.status === "OK" || task.status.startsWith("WARNINGS")) continue;
    const cached = known.get(task.upid);
    if (cached) {
      runs.push(cached);
      continue;
    }
    const log = await client.get<{ n: number; t: string }[]>(`${nodePath}/tasks/${encodeURIComponent(task.upid)}/log`, { limit: 10_000 });
    const run = toPveFailedRun(
      task,
      log.map((l) => l.t),
      ourVmids,
    );
    if (run) runs.push(run);
  }
  return runs.sort((a, b) => b.startedAt - a.startedAt);
}
