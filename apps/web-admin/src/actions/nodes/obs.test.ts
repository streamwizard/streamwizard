import { beforeEach, describe, expect, mock, test } from "bun:test";

const NODE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const NODE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const INSTANCE = "cccccccc-0000-4000-8000-000000000003";

const nodes: Record<string, { id: string; api_url: string | null }> = {
  [NODE_A]: { id: NODE_A, api_url: "https://a.node.test" },
  [NODE_B]: { id: NODE_B, api_url: "https://b.node.test" },
};
let lookups: string[] = [];

// Spread the real exports: bun shares module mocks across test files.
const realAssertAdmin = await import("@/lib/auth/assert-admin");
mock.module("@/lib/auth/assert-admin", () => ({ ...realAssertAdmin, assertAdmin: async () => "admin-user" }));
mock.module("@/lib/env", () => ({ env: {} }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
const realAdmin = await import("@repo/supabase/next/admin");
mock.module("@repo/supabase/next/admin", () => ({ ...realAdmin, createAdminClient: () => ({}), supabaseAdmin: {} }));
const realInstanceDetails = await import("@repo/supabase/queries/obs-nodes/instance-details");
mock.module("@repo/supabase/queries/obs-nodes/instance-details", () => ({
  ...realInstanceDetails,
  getInstanceByIdWithOwner: async (_c: unknown, id: string) => {
    lookups.push(id);
    return id === INSTANCE ? { id, node_id: NODE_B } : null;
  },
}));
const realNodeQueries = await import("@repo/supabase/queries/obs-nodes/nodes");
mock.module("@repo/supabase/queries/obs-nodes/nodes", () => ({
  ...realNodeQueries,
  getNodeById: async (_c: unknown, id: string) => {
    lookups.push(id);
    return nodes[id] ?? null;
  },
}));

const { createInstanceAction, deleteNodeAction, getInstanceNodeApiUrlAction, mintAdminNodeTokenAction, removeInstanceAdminAction } =
  await import("./obs");

describe("getInstanceNodeApiUrlAction", () => {
  beforeEach(() => {
    lookups = [];
  });

  test("returns the URL of the node that hosts the instance", async () => {
    const res = await getInstanceNodeApiUrlAction(INSTANCE, NODE_B);
    expect(res).toEqual({ data: { apiUrl: "https://b.node.test" }, error: null });
  });

  test("refuses a link that names another node, without looking that node up", async () => {
    const res = await getInstanceNodeApiUrlAction(INSTANCE, NODE_A);
    expect(res.data).toBeNull();
    expect(lookups).not.toContain(NODE_A);
  });

  test("refuses an unknown instance", async () => {
    const res = await getInstanceNodeApiUrlAction("dddddddd-0000-4000-8000-000000000004", NODE_B);
    expect(res.data).toBeNull();
  });
});

describe("bad input", () => {
  beforeEach(() => {
    lookups = [];
  });

  test("ids that aren't ids are refused before any lookup", async () => {
    expect((await getInstanceNodeApiUrlAction("../admin", NODE_B)).data).toBeNull();
    expect((await createInstanceAction("not-a-node")).error).toBeString();
    expect((await deleteNodeAction("1; drop table obs_nodes")).error).toBeString();
    expect(lookups).toEqual([]);
  });

  // toggleInstanceAdminAction isn't tested here: subscriptions.test.ts mocks
  // it process-wide, so which copy this file gets depends on the run order.
  test("a node token is never signed for an unknown scope or a bad target", async () => {
    expect(await mintAdminNodeTokenAction({ nodeId: NODE_A }, "files" as never)).toEqual({ data: null, error: expect.any(String) });
    expect(await mintAdminNodeTokenAction({ nodeId: "node-a" }, "admin:instances")).toEqual({ data: null, error: expect.any(String) });
    expect((await removeInstanceAdminAction(NODE_B, "not-an-instance")).error).toBeString();
    expect(lookups).toEqual([]);
  });

  test("instance options are bounded", async () => {
    const res = await createInstanceAction(NODE_A, { template: "x".repeat(500) });
    expect(res.data).toBeNull();
    expect(lookups).toEqual([]);
  });
});
