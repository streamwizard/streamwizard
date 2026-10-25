import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type Verdict =
  | { kind: "new" }
  | { kind: "same" }
  | { kind: "resized"; from: string; to: string }
  | { kind: "changed"; ratio: number; diffPath: string };

/**
 * 0.12 absorbs antialiasing noise between chromium builds without hiding a
 * button that moved; the ratio gate ignores a handful of stray pixels.
 */
const PIXEL_THRESHOLD = 0.12;
const RATIO_FLOOR = 0.0005;

export function compare(committedPath: string, next: Buffer, diffPath: string): Verdict {
  if (!existsSync(committedPath)) return { kind: "new" };

  const a = PNG.sync.read(readFileSync(committedPath));
  const b = PNG.sync.read(next);

  if (a.width !== b.width || a.height !== b.height) {
    return { kind: "resized", from: `${a.width}x${a.height}`, to: `${b.width}x${b.height}` };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: PIXEL_THRESHOLD,
  });
  const ratio = pixels / (a.width * a.height);
  if (ratio < RATIO_FLOOR) return { kind: "same" };

  writeFileSync(diffPath, PNG.sync.write(diff));
  return { kind: "changed", ratio, diffPath };
}

export function describe(verdict: Verdict): string {
  switch (verdict.kind) {
    case "new":
      return "new";
    case "same":
      return "same";
    case "resized":
      return `resized  ${verdict.from} -> ${verdict.to}`;
    case "changed":
      return `changed  ${(verdict.ratio * 100).toFixed(1)}%  ${verdict.diffPath}`;
  }
}
