import { describe, expect, it } from "bun:test";

import { unentitledInstanceIds } from "./cloud-obs-plan";

const instances = [
  { id: "i-1", user_id: "paid" },
  { id: "i-2", user_id: "revoked" },
  { id: "i-3", user_id: "paid" },
];

describe("unentitledInstanceIds", () => {
  it("lists only the instances whose user has no plan", async () => {
    expect(await unentitledInstanceIds(instances, async () => new Set(["paid"]))).toEqual(["i-2"]);
  });

  it("asks once per user, not per instance", async () => {
    let asked: string[] = [];
    await unentitledInstanceIds(instances, async (ids) => {
      asked = ids;
      return new Set();
    });
    expect(asked.sort()).toEqual(["paid", "revoked"]);
  });

  it("skips the lookup when nothing is running", async () => {
    let called = false;
    const ids = await unentitledInstanceIds([], async () => {
      called = true;
      return new Set();
    });
    expect(ids).toEqual([]);
    expect(called).toBe(false);
  });

  it("passes a lookup failure on instead of treating everyone as unentitled", async () => {
    await expect(
      unentitledInstanceIds(instances, async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
  });
});
