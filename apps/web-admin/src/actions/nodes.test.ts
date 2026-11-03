import { beforeEach, describe, expect, mock, test } from "bun:test";

const NODE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const NODE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const INSTANCE = "cccccccc-0000-4000-8000-000000000003";

const nodes: Record<string, { id: string; api_url: string | null }> = {
  [NODE_A]: { id: NODE_A, api_url: "https://a.node.test" },
  [NODE_B]: { id: NODE_B, api_url: "https://b.node.test" },
};
let lookups: string[] = [];

mock.module("@/lib/assert-admin", () => ({ assertAdmin: async () => "admin-user" }));
mock.module("@/lib/env", () => ({ env: {} }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
mock.module("@repo/supabase/next/admin", () => ({ createAdminClient: () => ({}), supabaseAdmin: {} }));
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/obs-nodes");
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  ...realNodeQueries,
  getInstanceByIdWithOwner: async (_c: unknown, id: string) => (id === INSTANCE ? { id, node_id: NODE_B } : null),
  getNodeById: async (_c: unknown, id: string) => {
    lookups.push(id);
    return nodes[id] ?? null;
  },
}));

const { getInstanceNodeApiUrlAction } = await import("./nodes");

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
