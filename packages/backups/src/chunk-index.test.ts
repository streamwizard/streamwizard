import { describe, expect, it } from "bun:test";
import { chunkIndexKind, parseChunkIndex, parseDynamicIndex, parseFixedIndex } from "./chunk-index";

const FIXED_MAGIC = [47, 127, 65, 237, 145, 253, 15, 205];
const DYNAMIC_MAGIC = [28, 145, 78, 165, 25, 186, 179, 205];

const digest = (byte: number) => new Uint8Array(32).fill(byte);
const hex = (byte: number) => byte.toString(16).padStart(2, "0").repeat(32);

/** Same layout as pbs-datastore FixedIndexHeader: size at 64, chunk_size at 72, 4096-byte header. */
function fixedIndex(sizeBytes: number, chunkSize: number, digestBytes: number[]): Uint8Array {
  const buf = new Uint8Array(4096 + digestBytes.length * 32);
  buf.set(FIXED_MAGIC, 0);
  const view = new DataView(buf.buffer);
  view.setBigUint64(64, BigInt(sizeBytes), true);
  view.setBigUint64(72, BigInt(chunkSize), true);
  digestBytes.forEach((b, i) => buf.set(digest(b), 4096 + i * 32));
  return buf;
}

function dynamicIndex(entries: { end: number; byte: number }[]): Uint8Array {
  const buf = new Uint8Array(4096 + entries.length * 40);
  buf.set(DYNAMIC_MAGIC, 0);
  const view = new DataView(buf.buffer);
  entries.forEach((e, i) => {
    view.setBigUint64(4096 + i * 40, BigInt(e.end), true);
    buf.set(digest(e.byte), 4096 + i * 40 + 8);
  });
  return buf;
}

describe("chunkIndexKind", () => {
  it("only accepts index files", () => {
    expect(chunkIndexKind("drive-scsi0.img.fidx")).toBe("fixed");
    expect(chunkIndexKind("root.pxar.didx")).toBe("dynamic");
    expect(chunkIndexKind("index.json.blob")).toBeNull();
    expect(chunkIndexKind("qemu-server.conf.blob")).toBeNull();
  });
});

describe("parseFixedIndex", () => {
  it("reads digests and gives the last chunk the remainder", () => {
    const idx = parseFixedIndex(fixedIndex(10, 4, [1, 2, 1]));
    expect(idx.kind).toBe("fixed");
    expect(idx.sizeBytes).toBe(10);
    expect(idx.digests).toEqual([hex(1), hex(2), hex(1)]);
    expect(idx.chunkSizes).toEqual([4, 4, 2]);
  });

  it("handles a 250 GiB disk header", () => {
    const size = 250 * 1024 ** 3;
    const chunk = 4 * 1024 ** 2;
    const idx = parseFixedIndex(fixedIndex(size, chunk, new Array(size / chunk).fill(0)));
    expect(idx.digests.length).toBe(64000);
    expect(idx.chunkSizes.at(-1)).toBe(chunk);
  });

  it("rejects wrong magic, truncated lists and a header that doesn't match", () => {
    expect(() => parseFixedIndex(dynamicIndex([]))).toThrow("not a fixed");
    expect(() => parseFixedIndex(fixedIndex(10, 4, [1, 2, 3]).slice(0, 4096 + 40))).toThrow("truncated");
    expect(() => parseFixedIndex(fixedIndex(10, 4, [1, 2]))).toThrow("doesn't match");
  });
});

describe("parseDynamicIndex", () => {
  it("derives chunk sizes from end offsets", () => {
    const idx = parseDynamicIndex(
      dynamicIndex([
        { end: 100, byte: 1 },
        { end: 250, byte: 2 },
        { end: 300, byte: 1 },
      ]),
    );
    expect(idx.sizeBytes).toBe(300);
    expect(idx.chunkSizes).toEqual([100, 150, 50]);
    expect(idx.digests).toEqual([hex(1), hex(2), hex(1)]);
    expect(parseChunkIndex("dynamic", dynamicIndex([{ end: 5, byte: 3 }])).digests).toEqual([hex(3)]);
  });

  it("rejects offsets that go backwards", () => {
    expect(() =>
      parseDynamicIndex(
        dynamicIndex([
          { end: 100, byte: 1 },
          { end: 50, byte: 2 },
        ]),
      ),
    ).toThrow("backwards");
  });
});
