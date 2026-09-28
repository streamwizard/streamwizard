// Parsers for PBS chunk index files, as served raw by
// GET /admin/datastore/{store}/download (proxmox-backup pbs-datastore:
// fixed_index.rs, dynamic_index.rs, file_formats.rs).
//
// Both formats start with a 4096-byte little-endian header:
//   fixed (.fidx, VM disks):     magic[8] uuid[16] ctime i64 index_csum[32]
//                                size u64 chunk_size u64 reserved
//                                → then N × 32-byte SHA-256 digests
//   dynamic (.didx, CT archives): magic[8] uuid[16] ctime i64 index_csum[32]
//                                reserved
//                                → then N × (end offset u64 + digest[32])
//
// Only the digest list and each chunk's uncompressed size are kept. The
// digest is SHA-256 of the uncompressed chunk (unencrypted backups), so the
// same data in two snapshots or two VMs has the same digest.

const HEADER_SIZE = 4096;
const DIGEST_SIZE = 32;
const FIXED_MAGIC = [47, 127, 65, 237, 145, 253, 15, 205];
const DYNAMIC_MAGIC = [28, 145, 78, 165, 25, 186, 179, 205];
/** Offset of `size` in the fixed header: magic + uuid + ctime + index_csum. */
const FIXED_SIZE_OFFSET = 8 + 16 + 8 + 32;

export interface ChunkIndex {
  kind: "fixed" | "dynamic";
  /** Uncompressed size of the archive the index describes. */
  sizeBytes: number;
  /** Digests as hex, in file order (the same digest can repeat). */
  digests: string[];
  /** Uncompressed size of each chunk, same order as digests. */
  chunkSizes: number[];
}

export type ChunkIndexKind = ChunkIndex["kind"];

/** Which parser a PBS archive file name needs, or null when it isn't a chunk index. */
export function chunkIndexKind(fileName: string): ChunkIndexKind | null {
  if (fileName.endsWith(".fidx")) return "fixed";
  if (fileName.endsWith(".didx")) return "dynamic";
  return null;
}

function hasMagic(buf: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, i) => buf[i] === byte);
}

function toHex(buf: Uint8Array, start: number): string {
  let out = "";
  for (let i = start; i < start + DIGEST_SIZE; i++) out += buf[i]!.toString(16).padStart(2, "0");
  return out;
}

function readU64(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("chunk index: value too large");
  return Number(value);
}

export function parseFixedIndex(buf: Uint8Array): ChunkIndex {
  if (buf.length < HEADER_SIZE || !hasMagic(buf, FIXED_MAGIC)) throw new Error("not a fixed chunk index (.fidx)");
  if ((buf.length - HEADER_SIZE) % DIGEST_SIZE !== 0) throw new Error("fixed chunk index has a truncated digest list");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sizeBytes = readU64(view, FIXED_SIZE_OFFSET);
  const chunkSize = readU64(view, FIXED_SIZE_OFFSET + 8);
  const count = (buf.length - HEADER_SIZE) / DIGEST_SIZE;
  if (chunkSize <= 0 || count !== Math.ceil(sizeBytes / chunkSize)) throw new Error("fixed chunk index header doesn't match its digest count");

  const digests: string[] = new Array(count);
  const chunkSizes: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    digests[i] = toHex(buf, HEADER_SIZE + i * DIGEST_SIZE);
    // Every chunk is chunk_size long except a shorter last one.
    chunkSizes[i] = i === count - 1 ? sizeBytes - chunkSize * (count - 1) : chunkSize;
  }
  return { kind: "fixed", sizeBytes, digests, chunkSizes };
}

export function parseDynamicIndex(buf: Uint8Array): ChunkIndex {
  const entrySize = 8 + DIGEST_SIZE;
  if (buf.length < HEADER_SIZE || !hasMagic(buf, DYNAMIC_MAGIC)) throw new Error("not a dynamic chunk index (.didx)");
  if ((buf.length - HEADER_SIZE) % entrySize !== 0) throw new Error("dynamic chunk index has a truncated entry list");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = (buf.length - HEADER_SIZE) / entrySize;

  const digests: string[] = new Array(count);
  const chunkSizes: number[] = new Array(count);
  let prevEnd = 0;
  for (let i = 0; i < count; i++) {
    const offset = HEADER_SIZE + i * entrySize;
    const end = readU64(view, offset);
    if (end < prevEnd) throw new Error("dynamic chunk index offsets go backwards");
    digests[i] = toHex(buf, offset + 8);
    chunkSizes[i] = end - prevEnd;
    prevEnd = end;
  }
  return { kind: "dynamic", sizeBytes: prevEnd, digests, chunkSizes };
}

export function parseChunkIndex(kind: ChunkIndexKind, buf: Uint8Array): ChunkIndex {
  return kind === "fixed" ? parseFixedIndex(buf) : parseDynamicIndex(buf);
}
