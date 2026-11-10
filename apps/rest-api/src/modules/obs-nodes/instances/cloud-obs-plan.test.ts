import { describe, expect, it } from "bun:test";

import { launchSubscriptionId, unentitledInstanceIds } from "@/modules/obs-nodes/instances/cloud-obs-plan";

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

describe("launchSubscriptionId", () => {
  const lookups = (own: boolean, active: string | null) => {
    const calls: string[] = [];
    return {
      calls,
      isOwnActivePlan: async (id: string, userId: string) => {
        calls.push(`own:${id}:${userId}`);
        return own;
      },
      activePlanOf: async (userId: string) => {
        calls.push(`active:${userId}`);
        return active;
      },
    };
  };

  it("uses the user's active plan when the node sends no subscription", async () => {
    const l = lookups(false, "sub-active");
    expect(await launchSubscriptionId("u1", undefined, l)).toBe("sub-active");
    expect(await launchSubscriptionId("u1", null, l)).toBe("sub-active");
    expect(l.calls).toEqual(["active:u1", "active:u1"]);
  });

  it("refuses when the node sends no subscription and the user has no plan", async () => {
    expect(await launchSubscriptionId("u1", undefined, lookups(true, null))).toBeNull();
  });

  it("keeps a sent subscription that is the user's own active plan", async () => {
    const l = lookups(true, null);
    expect(await launchSubscriptionId("u1", "sub-sent", l)).toBe("sub-sent");
    expect(l.calls).toEqual(["own:sub-sent:u1"]);
  });

  it("refuses a sent subscription that isn't the user's active plan", async () => {
    expect(await launchSubscriptionId("u1", "sub-sent", lookups(false, "sub-active"))).toBeNull();
  });
});
