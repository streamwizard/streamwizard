import { beforeEach, describe, expect, mock, test } from "bun:test";

// A grant change brings the user's Cloud OBS containers and IRL ingest keys in
// line with their plan: losing the plan stops containers and turns ingest keys
// off (never deletes them), getting one back turns the keys on again.

type Before = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  grant_note: string | null;
  plans: { name: string; product_id: string };
};

let before: Before;
let usersWithPlan: Set<string>;
let planLookupFails: boolean;
let keyChanges: { userId: string; active: boolean }[];
let stops: string[];
let reports: string[];

function subscription(productId = "cloud_obs"): Before {
  return {
    id: "sub-1",
    user_id: "u1",
    plan_id: "plan-1",
    status: "active",
    current_period_end: null,
    grant_note: null,
    plans: { name: "Plan", product_id: productId },
  };
}

// Spread the real exports: bun shares module mocks across test files.
const realSentry = await import("@repo/sentry");
mock.module("@repo/sentry", () => ({
  ...realSentry,
  reportError: (_error: unknown, context: string) => {
    reports.push(context);
  },
}));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
mock.module("@/lib/assert-admin", () => ({ assertAdmin: async () => "admin-1" }));
mock.module("@/lib/platform-events", () => ({ actorIdentity: async () => ({}), eventIdentity: async () => ({}) }));
mock.module("@/actions/nodes", () => ({
  toggleInstanceAdminAction: async (_nodeId: string, instanceId: string) => {
    stops.push(instanceId);
    return { error: null };
  },
}));
mock.module("@repo/supabase/next/admin", () => ({ createAdminClient: () => ({}), supabaseAdmin: {} }));
mock.module("@repo/supabase/queries/platform-events", () => ({ logPlatformEvent: async () => {} }));

const realSubscriptions = await import("@repo/supabase/queries/subscriptions");
mock.module("@repo/supabase/queries/subscriptions", () => ({
  ...realSubscriptions,
  cancelSubscription: async () => ({ error: null }),
  cancelSubscriptions: async () => ({ error: null }),
  getLiveSubscriptionsForUser: async () => ({ data: [] }),
  getPlanLimits: async () => null,
  getPlanProductId: async () => before.plans.product_id,
  getPlanWithProduct: async () => ({ id: before.plan_id, name: before.plans.name, product_id: before.plans.product_id }),
  getSubscriptionWithPlan: async () => before,
  updateSubscriptionGrant: async () => ({ error: null }),
  upsertSubscriptionGrant: async () => ({ error: null }),
  usersWithActiveSubscription: async (_client: unknown, userIds: string[], productId: string) => {
    if (planLookupFails) throw new Error("db down");
    expect(productId).toBe("cloud_obs");
    return new Set(userIds.filter((id) => usersWithPlan.has(id)));
  },
}));

const realObsNodes = await import("@repo/supabase/queries/obs-nodes");
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  ...realObsNodes,
  listRunningObsInstancesByUser: async () => [{ id: "inst-1", node_id: "node-1" }],
  updateObsInstancesByUser: async () => {},
}));

const realIngest = await import("@repo/supabase/queries/ingest");
mock.module("@repo/supabase/queries/ingest", () => ({
  ...realIngest,
  setIngestKeysActiveForUser: async (_client: unknown, userId: string, active: boolean) => {
    keyChanges.push({ userId, active });
    return ["key-1"];
  },
}));

const { grantSubscriptionAction, revokeSubscriptionAction, updateSubscriptionAction } = await import("./subscriptions");

beforeEach(() => {
  before = subscription();
  usersWithPlan = new Set();
  planLookupFails = false;
  keyChanges = [];
  stops = [];
  reports = [];
});

describe("revokeSubscriptionAction", () => {
  test("revoking the last Cloud OBS plan turns the user's ingest keys off and stops their containers", async () => {
    expect(await revokeSubscriptionAction("sub-1")).toEqual({ error: null });
    expect(keyChanges).toEqual([{ userId: "u1", active: false }]);
    expect(stops).toEqual(["inst-1"]);
  });

  test("another active Cloud OBS grant keeps the keys on and the containers running", async () => {
    usersWithPlan.add("u1");
    await revokeSubscriptionAction("sub-1");
    expect(keyChanges).toEqual([{ userId: "u1", active: true }]);
    expect(stops).toEqual([]);
  });

  test("a failed plan lookup changes nothing and is reported", async () => {
    planLookupFails = true;
    await revokeSubscriptionAction("sub-1");
    expect(keyChanges).toEqual([]);
    expect(stops).toEqual([]);
    expect(reports).toContain("actions/subscriptions:plan-lookup");
  });

  test("revoking another product leaves ingest keys alone", async () => {
    before = subscription("ingest_server");
    await revokeSubscriptionAction("sub-1");
    expect(keyChanges).toEqual([]);
    expect(stops).toEqual([]);
  });
});

describe("updateSubscriptionAction", () => {
  test("a change that ends the plan (past_due or a past expiry) turns the ingest keys off", async () => {
    await updateSubscriptionAction("sub-1", { status: "past_due", expiresAt: null, note: null });
    expect(keyChanges).toEqual([{ userId: "u1", active: false }]);
    expect(stops).toEqual(["inst-1"]);
  });

  test("a change back to an active plan turns the ingest keys on", async () => {
    usersWithPlan.add("u1");
    await updateSubscriptionAction("sub-1", { status: "active", expiresAt: null, note: null });
    expect(keyChanges).toEqual([{ userId: "u1", active: true }]);
    expect(stops).toEqual([]);
  });
});

describe("grantSubscriptionAction", () => {
  test("granting a Cloud OBS plan turns the user's ingest keys back on", async () => {
    usersWithPlan.add("u1");
    expect(await grantSubscriptionAction("u1", "plan-1", "active", null, null)).toEqual({ error: null });
    expect(keyChanges).toEqual([{ userId: "u1", active: true }]);
    expect(stops).toEqual([]);
  });

  test("granting another product leaves ingest keys alone", async () => {
    before = subscription("ingest_server");
    await grantSubscriptionAction("u1", "plan-1", "active", null, null);
    expect(keyChanges).toEqual([]);
  });
});
