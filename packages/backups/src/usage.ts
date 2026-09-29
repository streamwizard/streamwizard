// What our backups really take on PBS (docs/backup-sizes-plan.md).
//
// PBS 4.2 has no per-group or per-snapshot unique size, so we work it out
// from the chunk index of every kept snapshot:
//   - Uploaded (per snapshot): what the backup run sent, from the upload
//     stats PBS writes into the manifest. Fixed once the backup is done.
//   - Only in this snapshot: chunks no other kept snapshot (of any of our
//     VMs) references, i.e. roughly what pruning it frees. Changes as
//     neighbouring snapshots come and go.
//   - Unique (per VM): every chunk its kept snapshots reference, counted once.
//   - Shared: the part of Unique that another VM in our namespace also uses.
//   - On disk ≈: (Unique − Shared) × the VM's compression ratio, taken from
//     the upload stats PBS writes into each manifest. PBS has no API for the
//     compressed size of a single chunk, hence the estimate.
// All byte counts before compression unless the name says otherwise.

import type { ChunkIndex } from "./chunk-index";

/** `unprotected.chunk_upload_stats` of a snapshot manifest, written by PBS at backup finish. */
export interface UploadStats {
  /** Chunks the client uploaded (chunks it knew from the previous snapshot are never sent). */
  chunks: number;
  /** Uploaded chunks PBS already had. */
  duplicates: number;
  /** Uncompressed bytes uploaded. */
  rawBytes: number;
  /** Bytes sent after compression, duplicates included. */
  compressedBytes: number;
}

/** Kept per snapshot in backup_poll_state, so only the numbers the UI shows. */
export interface SnapshotUsage {
  /** Uncompressed bytes of chunks no other kept snapshot references. */
  exclusiveBytes: number;
  /** UploadStats.compressedBytes, null when the manifest had no stats. */
  uploadedBytes: number | null;
  /** UploadStats.rawBytes. */
  uploadedRawBytes: number | null;
}

/** The part of the upload stats the compression ratio needs. */
export type UploadSizes = Pick<UploadStats, "rawBytes" | "compressedBytes">;

export interface GroupUsage {
  /** Sum of the kept snapshots' archive sizes: what "size" in PBS adds up to. */
  logicalBytes: number;
  /** Every chunk the kept snapshots reference, counted once. */
  uniqueBytes: number;
  uniqueChunks: number;
  /** Part of uniqueBytes that another group in our namespace also references. */
  sharedBytes: number;
  /** compressed / uncompressed from the upload stats; null without stats. */
  compression: number | null;
  /** (uniqueBytes − sharedBytes) × compression. */
  onDiskEstBytes: number | null;
}

export interface NamespaceUsage {
  logicalBytes: number;
  uniqueBytes: number;
  uniqueChunks: number;
  compression: number | null;
  onDiskEstBytes: number | null;
  /** logicalBytes / uniqueBytes. */
  dedupFactor: number | null;
}

export interface PbsUsage {
  /** Hash of the kept snapshot list; unchanged list → no downloads. */
  fingerprint: string;
  /** epoch seconds */
  computedAt: number;
  /** Keyed by "vm/103". */
  groups: Record<string, GroupUsage>;
  namespace: NamespaceUsage;
}

export const groupKey = (type: string, id: string) => `${type}/${id}`;
export const snapshotKey = (type: string, id: string, time: number) => `${type}/${id}/${time}`;

/** FNV-1a over the sorted snapshot keys. Short enough to keep in backup_poll_state. */
export function snapshotFingerprint(snapshots: { type: string; id: string; time: number }[]): string {
  const text = snapshots
    .map((s) => snapshotKey(s.type, s.id, s.time))
    .sort()
    .join("\n");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${snapshots.length}:${hash.toString(16).padStart(8, "0")}`;
}

/** Reads chunk_upload_stats out of a decoded manifest (index.json.blob), or null. */
export function toUploadStats(manifest: unknown): UploadStats | null {
  const stats = (manifest as { unprotected?: { chunk_upload_stats?: Record<string, unknown> } } | null)?.unprotected?.chunk_upload_stats;
  if (!stats) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const chunks = num(stats.count);
  const rawBytes = num(stats.size);
  const compressedBytes = num(stats.compressed_size);
  if (chunks === null || rawBytes === null || compressedBytes === null) return null;
  return { chunks, duplicates: num(stats.duplicates) ?? 0, rawBytes, compressedBytes };
}

function compressionOf(stats: UploadSizes[]): number | null {
  const raw = stats.reduce((sum, s) => sum + s.rawBytes, 0);
  if (raw <= 0) return null;
  return stats.reduce((sum, s) => sum + s.compressedBytes, 0) / raw;
}

interface ChunkRef {
  size: number;
  /** Kept snapshots of this group that reference the chunk. */
  refs: number;
  /** backup-time of the last snapshot that referenced it (the only one when refs is 1). */
  owner: number;
}

/**
 * Feed snapshots one at a time, so only one digest list is held besides the
 * per-group chunk maps.
 */
export function createUsageAccumulator() {
  const groups = new Map<string, { chunks: Map<string, ChunkRef>; times: number[]; logicalBytes: number }>();

  return {
    add(group: string, time: number, indexes: ChunkIndex[]): void {
      let state = groups.get(group);
      if (!state) {
        state = { chunks: new Map(), times: [], logicalBytes: 0 };
        groups.set(group, state);
      }
      state.times.push(time);

      const seen = new Set<string>();
      for (const index of indexes) {
        state.logicalBytes += index.sizeBytes;
        for (let i = 0; i < index.digests.length; i++) {
          const digest = index.digests[i]!;
          if (seen.has(digest)) continue;
          seen.add(digest);
          const ref = state.chunks.get(digest);
          if (ref) {
            ref.refs++;
            ref.owner = time;
          } else {
            state.chunks.set(digest, { size: index.chunkSizes[i]!, refs: 1, owner: time });
          }
        }
      }
    },

    /**
     * Per-group, per-snapshot and namespace totals. `uploads` holds each
     * group's kept snapshots' upload stats. Snapshot keys are "vm/100/<time>".
     */
    finish(uploads: Map<string, UploadSizes[]>): {
      groups: Record<string, GroupUsage>;
      namespace: NamespaceUsage;
      exclusive: Map<string, number>;
    } {
      // How many of our groups reference each chunk.
      const groupRefs = new Map<string, number>();
      for (const state of groups.values()) {
        for (const digest of state.chunks.keys()) groupRefs.set(digest, (groupRefs.get(digest) ?? 0) + 1);
      }

      const result: Record<string, GroupUsage> = {};
      const exclusive = new Map<string, number>();
      let logicalBytes = 0;
      let uniqueBytes = 0;
      const counted = new Set<string>();
      for (const [group, state] of groups) {
        for (const time of state.times) exclusive.set(`${group}/${time}`, 0);
        let groupUnique = 0;
        let sharedBytes = 0;
        for (const [digest, ref] of state.chunks) {
          groupUnique += ref.size;
          const shared = groupRefs.get(digest)! > 1;
          if (shared) sharedBytes += ref.size;
          else if (ref.refs === 1) exclusive.set(`${group}/${ref.owner}`, exclusive.get(`${group}/${ref.owner}`)! + ref.size);
          if (!counted.has(digest)) {
            counted.add(digest);
            uniqueBytes += ref.size;
          }
        }
        const compression = compressionOf(uploads.get(group) ?? []);
        logicalBytes += state.logicalBytes;
        result[group] = {
          logicalBytes: state.logicalBytes,
          uniqueBytes: groupUnique,
          uniqueChunks: state.chunks.size,
          sharedBytes,
          compression,
          onDiskEstBytes: compression === null ? null : Math.round((groupUnique - sharedBytes) * compression),
        };
      }

      const compression = compressionOf([...uploads.values()].flat());
      return {
        groups: result,
        exclusive,
        namespace: {
          logicalBytes,
          uniqueBytes,
          uniqueChunks: counted.size,
          compression,
          onDiskEstBytes: compression === null ? null : Math.round(uniqueBytes * compression),
          dedupFactor: uniqueBytes > 0 ? logicalBytes / uniqueBytes : null,
        },
      };
    },
  };
}
