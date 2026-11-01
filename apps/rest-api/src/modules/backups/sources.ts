import {
  chunkIndexKind,
  createUsageAccumulator,
  findOurStorages,
  groupKey,
  parseChunkIndex,
  parseGuestDisks,
  snapshotFingerprint,
  snapshotKey,
  toDatastoreUsage,
  toPbsGc,
  toPbsJobs,
  toPbsSnapshots,
  toPveFailedRun,
  toPveGuests,
  toPveJobs,
  toUploadStats,
  type GuestDisk,
  type PbsData,
  type PbsSnapshot,
  type PbsUsage,
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
  type SnapshotUsage,
  type UploadSizes,
} from "@repo/backups";
import type { ProxmoxClient } from "@repo/proxmox";

/** Manifest of a snapshot; the only file fetched decoded. */
const MANIFEST = "index.json.blob";
const MANIFEST_MAX_BYTES = 1024 * 1024;
/** One chunk index: 64 MB covers an 8 TiB disk at 4 MiB chunks. */
const INDEX_MAX_BYTES = 64 * 1024 * 1024;
/** All index downloads of one usage pass together. */
const USAGE_PASS_MAX_BYTES = 256 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

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
  const snaps = toPbsSnapshots(snapshots.value);
  const files = new Map(
    snapshots.value.map((s) => [
      snapshotKey(s["backup-type"], s["backup-id"], s["backup-time"]),
      (s.files ?? []).map((f) => f.filename),
    ]),
  );
  let usage: PbsUsage | null = prev?.usage ?? null;
  let snapshotUsage = new Map(
    (prev?.snapshots ?? []).filter((s) => s.usage).map((s) => [snapshotKey(s.type, s.id, s.time), s.usage!]),
  );
  try {
    const result = await fetchPbsUsage(client, datastore, namespace, snaps, files, prev, Math.floor(Date.now() / 1000));
    usage = result.usage;
    snapshotUsage = result.snapshots;
  } catch (error) {
    // Sizes are extra; snapshot health doesn't depend on them.
    warnings.push(`usage: ${message(error)}`);
  }
  const pick = <R, V>(result: PromiseSettledResult<R>, map: (value: R) => V, fallback: V): V => {
    if (result.status === "fulfilled") return map(result.value);
    warnings.push(message(result.reason));
    return fallback;
  };

  return {
    data: {
      snapshots: snaps.map((s) => ({ ...s, usage: snapshotUsage.get(snapshotKey(s.type, s.id, s.time)) ?? null })),
      datastore: pick(status, toDatastoreUsage, prev?.datastore ?? null),
      gc: pick(gc, (raw) => toPbsGc(raw, datastore), prev?.gc ?? null),
      verifyJobs: pick(verify, (raw) => toPbsJobs(raw, "verify", datastore, namespace), prev?.verifyJobs ?? []),
      pruneJobs: pick(prune, (raw) => toPbsJobs(raw, "prune", datastore, namespace), prev?.pruneJobs ?? []),
      usage,
    },
    warnings,
  };
}

/**
 * Downloads one file of a snapshot in our namespace. The only way this
 * module reads backup data, so the allowlist lives here:
 *   - the manifest, decoded (a small JSON blob);
 *   - chunk index files (.fidx/.didx), raw. Never decoded: download-decoded
 *     of an index streams the whole disk image.
 */
export function downloadSnapshotFile(
  client: ProxmoxClient,
  datastore: string,
  namespace: string,
  snap: Pick<PbsSnapshot, "type" | "id" | "time">,
  fileName: string,
): Promise<Uint8Array> {
  const store = encodeURIComponent(datastore);
  const params = {
    ns: namespace,
    "backup-type": snap.type,
    "backup-id": snap.id,
    "backup-time": snap.time,
    "file-name": fileName,
  };
  if (fileName === MANIFEST) {
    return client.getRaw(`/admin/datastore/${store}/download-decoded`, params, {
      maxBytes: MANIFEST_MAX_BYTES,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
  }
  if (chunkIndexKind(fileName) && !fileName.includes("/")) {
    return client.getRaw(`/admin/datastore/${store}/download`, params, {
      maxBytes: INDEX_MAX_BYTES,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
  }
  return Promise.reject(new Error(`refusing to download ${fileName}`));
}

/**
 * Deduplicated sizes for our namespace (docs/backup-sizes-plan.md). Only
 * runs when the snapshot list changed since the last pass (a backup or a
 * prune); otherwise the previous result is reused without any download.
 * Upload stats never change, so each manifest is read once.
 */
export async function fetchPbsUsage(
  client: ProxmoxClient,
  datastore: string,
  namespace: string,
  snapshots: PbsSnapshot[],
  files: Map<string, string[]>,
  prev: PbsData | null,
  nowSeconds: number,
): Promise<{ usage: PbsUsage; snapshots: Map<string, SnapshotUsage> }> {
  // A backup that is still running is already listed, but has no manifest
  // yet. Leave it out until it finishes; the fingerprint then changes.
  const done = snapshots.filter((s) => files.get(snapshotKey(s.type, s.id, s.time))?.includes(MANIFEST));
  const fingerprint = snapshotFingerprint(done);
  const known = new Map((prev?.snapshots ?? []).filter((s) => s.usage).map((s) => [snapshotKey(s.type, s.id, s.time), s.usage!]));
  const allKnown = done.every((s) => known.has(snapshotKey(s.type, s.id, s.time)));
  if (prev?.usage && prev.usage.fingerprint === fingerprint && allKnown) return { usage: prev.usage, snapshots: known };

  const byGroup = new Map<string, PbsSnapshot[]>();
  for (const snap of done) {
    const key = groupKey(snap.type, snap.id);
    byGroup.set(key, [...(byGroup.get(key) ?? []), snap]);
  }

  const acc = createUsageAccumulator();
  const uploads = new Map<string, UploadSizes[]>();
  const uploadByKey = new Map<string, UploadSizes | null>();
  let downloaded = 0;

  // One file at a time: this is a background pass, PBS shouldn't notice it.
  for (const [group, snaps] of byGroup) {
    for (const snap of snaps) {
      const key = snapshotKey(snap.type, snap.id, snap.time);
      try {
        const indexes = [];
        for (const fileName of files.get(key) ?? []) {
          const kind = chunkIndexKind(fileName);
          if (!kind) continue;
          const buf = await downloadSnapshotFile(client, datastore, namespace, snap, fileName);
          downloaded += buf.byteLength;
          if (downloaded > USAGE_PASS_MAX_BYTES) throw new Error(`index downloads passed ${USAGE_PASS_MAX_BYTES / 1024 / 1024} MB, stopped`);
          indexes.push(parseChunkIndex(kind, buf));
        }
        acc.add(group, snap.time, indexes);

        // Retry only when an earlier pass found no stats.
        const prevUsage = known.get(key);
        let upload: UploadSizes | null =
          prevUsage?.uploadedBytes != null && prevUsage.uploadedRawBytes != null
            ? { rawBytes: prevUsage.uploadedRawBytes, compressedBytes: prevUsage.uploadedBytes }
            : null;
        if (!upload) {
          const manifest = await downloadSnapshotFile(client, datastore, namespace, snap, MANIFEST);
          upload = toUploadStats(JSON.parse(new TextDecoder().decode(manifest)));
        }
        uploadByKey.set(key, upload);
        if (upload) uploads.set(group, [...(uploads.get(group) ?? []), upload]);
      } catch (error) {
        throw new Error(`${key}: ${message(error)}`);
      }
    }
  }

  const { groups, namespace: ns, exclusive } = acc.finish(uploads);
  const result = new Map<string, SnapshotUsage>();
  for (const [key, upload] of uploadByKey) {
    result.set(key, { exclusiveBytes: exclusive.get(key) ?? 0, uploadedBytes: upload?.compressedBytes ?? null, uploadedRawBytes: upload?.rawBytes ?? null });
  }
  return { usage: { fingerprint, computedAt: nowSeconds, groups, namespace: ns }, snapshots: result };
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

  const allGuests = toPveGuests(qemu, lxc);
  const ourJobs = toPveJobs(jobs, findOurStorages(storages, datastore, namespace), node, allGuests);
  const ourVmids = new Set(ourJobs.flatMap((j) => j.vmids));

  const warnings: string[] = [];

  // Disk sizes, only for guests we back up. Only the parsed disks are kept,
  // never the raw config.
  const prevDisks = new Map((prev?.guests ?? []).filter((g) => g.disks).map((g) => [g.vmid, g.disks!]));
  const configs = await Promise.allSettled(
    allGuests
      .filter((g) => ourVmids.has(g.vmid))
      .map(async (g) => {
        const config = await client.get<Record<string, unknown>>(`${nodePath}/${g.type}/${g.vmid}/config`);
        return [g.vmid, parseGuestDisks(config, g.type)] as const;
      }),
  );
  const disks = new Map<number, GuestDisk[]>();
  for (const result of configs) {
    if (result.status === "fulfilled") disks.set(result.value[0], result.value[1]);
    else warnings.push(message(result.reason));
  }
  const guests = allGuests.map((g) => {
    const d = disks.get(g.vmid) ?? (ourVmids.has(g.vmid) ? prevDisks.get(g.vmid) : undefined);
    return d ? { ...g, disks: d } : g;
  });
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
    const log = await client.get<{ n: number; t: string }[]>(`${nodePath}/tasks/${encodeURIComponent(task.upid)}/log`, {
      limit: 10_000,
    });
    const run = toPveFailedRun(
      task,
      log.map((l) => l.t),
      ourVmids,
    );
    if (run) runs.push(run);
  }
  return runs.sort((a, b) => b.startedAt - a.startedAt);
}
