import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { R2ObjectInfo } from "@repo/storage";

// Same process-wide mock shape as the other rest-api tests.
let reported: string[] = [];
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));

// Keeps the env schema (and R2 credentials) out of the test.
mock.module("../lib/r2", () => ({ r2: null }));

const { createAssetReconciler, ORPHAN_GRACE_MS } = await import("./asset-reconciler");

const NOW = new Date("2026-10-03T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms);

describe("asset reconciler", () => {
  let deletedObjects: string[];
  let deletedRows: [string, string][];

  beforeEach(() => {
    deletedObjects = [];
    deletedRows = [];
    reported = [];
  });

  const make = (opts: {
    stale?: { id: string; user_id: string; key: string }[];
    keys?: string[];
    objects?: R2ObjectInfo[];
    deleteObject?: (key: string) => Promise<void>;
  }) =>
    createAssetReconciler({
      selectStalePending: async () => opts.stale ?? [],
      deleteRow: async (id, userId) => {
        deletedRows.push([id, userId]);
      },
      selectAllKeys: async () => opts.keys ?? [],
      listObjects: async () => opts.objects ?? [],
      deleteObject:
        opts.deleteObject ??
        (async (key) => {
          deletedObjects.push(key);
        }),
      now: () => NOW,
    });

  it("drops stale pending rows and their objects", async () => {
    const result = await make({ stale: [{ id: "a1", user_id: "u1", key: "assets/u1/a1/x.png" }] }).sweep();
    expect(result).toEqual({ removedPending: 1, removedOrphans: 0 });
    expect(deletedRows).toEqual([["a1", "u1"]]);
    expect(deletedObjects).toEqual(["assets/u1/a1/x.png"]);
  });

  it("still drops the row when the object is already gone", async () => {
    const result = await make({
      stale: [{ id: "a1", user_id: "u1", key: "assets/u1/a1/x.png" }],
      deleteObject: async () => {
        throw new Error("NoSuchKey");
      },
    }).sweep();
    expect(result.removedPending).toBe(1);
    expect(deletedRows).toEqual([["a1", "u1"]]);
  });

  it("removes old orphans and keeps known keys", async () => {
    const result = await make({
      keys: ["assets/u1/a1/known.png"],
      objects: [
        { key: "assets/u1/a1/known.png", size: 1, lastModified: ago(2 * ORPHAN_GRACE_MS) },
        { key: "assets/u2/a2/orphan.png", size: 1, lastModified: ago(2 * ORPHAN_GRACE_MS) },
      ],
    }).sweep();
    expect(result).toEqual({ removedPending: 0, removedOrphans: 1 });
    expect(deletedObjects).toEqual(["assets/u2/a2/orphan.png"]);
  });

  it("keeps fresh orphans: the upload may have landed after the key snapshot", async () => {
    const result = await make({
      objects: [
        { key: "assets/u1/a1/fresh.png", size: 1, lastModified: ago(0) },
        { key: "assets/u1/a2/no-date.png", size: 1 },
      ],
    }).sweep();
    expect(result.removedOrphans).toBe(0);
    expect(deletedObjects).toEqual([]);
  });

  it("shares one in-flight sweep", async () => {
    const reconciler = make({});
    const [a, b] = [reconciler.sweep(), reconciler.sweep()];
    expect(a).toBe(b);
    await a;
  });
});
