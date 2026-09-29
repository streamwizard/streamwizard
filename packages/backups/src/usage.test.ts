import { describe, expect, it } from "bun:test";
import type { ChunkIndex } from "./chunk-index";
import { createUsageAccumulator, snapshotFingerprint, toUploadStats, type UploadStats } from "./usage";

/** A fixed index with 10-byte chunks, one letter per digest. */
const idx = (chunks: string): ChunkIndex => ({
  kind: "fixed",
  sizeBytes: chunks.length * 10,
  digests: [...chunks],
  chunkSizes: [...chunks].map(() => 10),
});

const upload = (rawBytes: number, compressedBytes: number): UploadStats => ({ chunks: 1, duplicates: 0, rawBytes, compressedBytes });

describe("toUploadStats", () => {
  it("reads chunk_upload_stats from a manifest", () => {
    const manifest = { unprotected: { chunk_upload_stats: { compressed_size: 1009599813, count: 1244, duplicates: 1, size: 5217714852 }, notes: "pfsense" } };
    expect(toUploadStats(manifest)).toEqual({ chunks: 1244, duplicates: 1, rawBytes: 5217714852, compressedBytes: 1009599813 });
  });

  it("returns null when the stats are missing or malformed", () => {
    expect(toUploadStats({ unprotected: { notes: "x" } })).toBeNull();
    expect(toUploadStats({ unprotected: { chunk_upload_stats: { count: "1", size: 1, compressed_size: 1 } } })).toBeNull();
    expect(toUploadStats(null)).toBeNull();
  });
});

describe("snapshotFingerprint", () => {
  it("ignores order and changes when a snapshot is added or pruned", () => {
    const a = { type: "vm", id: "100", time: 1 };
    const b = { type: "vm", id: "100", time: 2 };
    const c = { type: "vm", id: "108", time: 2 };
    expect(snapshotFingerprint([a, b])).toBe(snapshotFingerprint([b, a]));
    expect(snapshotFingerprint([a, b])).not.toBe(snapshotFingerprint([a, b, c]));
    expect(snapshotFingerprint([a, b])).not.toBe(snapshotFingerprint([b]));
  });
});

describe("createUsageAccumulator", () => {
  it("finds the data only one kept snapshot references", () => {
    const acc = createUsageAccumulator();
    acc.add("vm/100", 1, [idx("aabc")]);
    acc.add("vm/100", 2, [idx("abcd")]);
    acc.add("vm/100", 3, [idx("xd")]);
    const { exclusive } = acc.finish(new Map());
    // a b c are in 1 and 2; d in 2 and 3; x only in 3.
    expect(Object.fromEntries(exclusive)).toEqual({ "vm/100/1": 0, "vm/100/2": 0, "vm/100/3": 10 });
  });

  it("unions all archives of a snapshot", () => {
    const acc = createUsageAccumulator();
    acc.add("vm/100", 1, [idx("ab"), idx("bc")]);
    const { exclusive, groups } = acc.finish(new Map());
    expect(exclusive.get("vm/100/1")).toBe(30);
    expect(groups["vm/100"]!.logicalBytes).toBe(40);
  });

  it("doesn't count a chunk another VM uses as only in this snapshot", () => {
    const acc = createUsageAccumulator();
    acc.add("vm/100", 1, [idx("ab")]);
    acc.add("vm/108", 1, [idx("a")]);
    expect(acc.finish(new Map()).exclusive.get("vm/100/1")).toBe(10);
  });

  it("works out unique, shared, compression and on-disk per group and for the namespace", () => {
    const acc = createUsageAccumulator();
    acc.add("vm/100", 1, [idx("abc")]);
    acc.add("vm/100", 2, [idx("abd")]);
    acc.add("vm/108", 1, [idx("aez")]);
    const { groups, namespace } = acc.finish(
      new Map([
        ["vm/100", [upload(100, 50)]],
        ["vm/108", [upload(100, 20), upload(100, 20)]],
      ]),
    );

    // vm/100 references a b c d; "a" is shared with vm/108.
    expect(groups["vm/100"]).toEqual({ logicalBytes: 60, uniqueBytes: 40, uniqueChunks: 4, sharedBytes: 10, compression: 0.5, onDiskEstBytes: 15 });
    expect(groups["vm/108"]).toEqual({ logicalBytes: 30, uniqueBytes: 30, uniqueChunks: 3, sharedBytes: 10, compression: 0.2, onDiskEstBytes: 4 });
    // a b c d e z = 6 chunks; compression (50 + 20 + 20) / 300 = 0.3.
    expect(namespace).toEqual({ logicalBytes: 90, uniqueBytes: 60, uniqueChunks: 6, compression: 0.3, onDiskEstBytes: 18, dedupFactor: 1.5 });
  });

  it("leaves on-disk empty without upload stats", () => {
    const acc = createUsageAccumulator();
    acc.add("vm/100", 1, [idx("a")]);
    const { groups, namespace } = acc.finish(new Map());
    expect(groups["vm/100"]!.onDiskEstBytes).toBeNull();
    expect(namespace.onDiskEstBytes).toBeNull();
    expect(namespace.dedupFactor).toBe(1);
  });
});
