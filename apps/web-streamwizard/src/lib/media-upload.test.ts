import { describe, expect, it } from "bun:test";
import { filesFromEntries, partitionUploadable, type EntryLike } from "./media-upload";

// Plain objects rather than new File(): Bun's File appends ";charset=utf-8"
// to text types, which no browser does for a picked .json file.
const file = (name: string, type: string) => ({ name, type }) as File;

const fileEntry = (f: File): EntryLike => ({
  isFile: true,
  isDirectory: false,
  file: (success) => success(f),
});

/** A folder whose reader returns its children in batches, then an empty batch. */
const dirEntry = (children: EntryLike[], batchSize = 2): EntryLike => ({
  isFile: false,
  isDirectory: true,
  createReader: () => {
    let offset = 0;
    return {
      readEntries: (success) => {
        const batch = children.slice(offset, offset + batchSize);
        offset += batch.length;
        success(batch);
      },
    };
  },
});

describe("partitionUploadable", () => {
  it("keeps media the library accepts and skips hidden and unsupported files", () => {
    const png = file("logo.png", "image/png");
    const mp3 = file("ding.mp3", "audio/mpeg");
    const lottie = file("spin.json", "application/json");
    const dsStore = file(".DS_Store", "");
    const pdf = file("readme.pdf", "application/pdf");
    const svg = file("icon.svg", "image/svg+xml");

    const { uploadable, skipped } = partitionUploadable([png, dsStore, mp3, pdf, lottie, svg]);
    expect(uploadable).toEqual([png, mp3, lottie]);
    expect(skipped).toEqual([dsStore, pdf, svg]);
  });
});

describe("filesFromEntries", () => {
  it("walks nested folders, across every readEntries batch", async () => {
    const a = file("a.png", "image/png");
    const b = file("b.png", "image/png");
    const c = file("c.png", "image/png");
    const d = file("d.mp3", "audio/mpeg");
    const e = file("e.webm", "video/webm");

    const tree = [
      fileEntry(a),
      dirEntry([fileEntry(b), fileEntry(c), dirEntry([fileEntry(d)]), fileEntry(e)], 2),
    ];
    expect(await filesFromEntries(tree)).toEqual([a, b, c, d, e]);
  });

  it("an empty folder gives no files", async () => {
    expect(await filesFromEntries([dirEntry([])])).toEqual([]);
  });
});
