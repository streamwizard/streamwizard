import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";

process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");

const NODE_A_KEY = `events-test-node-a-${randomBytes(8).toString("hex")}`;
const NODE_B_KEY = `events-test-node-b-${randomBytes(8).toString("hex")}`;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const nodeByKeyHash = new Map([
  [hash(NODE_A_KEY), "node-a"],
  [hash(NODE_B_KEY), "node-b"],
]);

/** instance id -> { node, owner } */
let rows: Map<string, { node_id: string; user_id: string }>;
let broadcasts: { userId: string; type: string; payload: Record<string, unknown> }[];
let ownerLookups: number;

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/subscriptions", () => ({
  isActiveSubscriptionOfUser: async () => true,
  usersWithActiveSubscription: async () => new Set(),
}));
mock.module("@/env", () => ({
  env: { NODE_TOKEN_PUBLIC_JWKS: undefined },
}));
// Spread the real exports: bun shares module mocks across test files.
const realQueries = await import("@repo/supabase/queries/obs-nodes");
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  ...realQueries,
  lookupNodeByApiKeyHash: async (_c: unknown, keyHash: string) => nodeByKeyHash.get(keyHash) ?? null,
  getObsInstanceOwnerForNode: async (_c: unknown, id: string, nodeId: string) => {
    ownerLookups++;
    const r = rows.get(id);
    return r && r.node_id === nodeId ? r.user_id : null;
  },
  deleteObsInstanceForNode: async (_c: unknown, id: string, nodeId: string) => {
    const r = rows.get(id);
    if (!r || r.node_id !== nodeId) return null;
    rows.delete(id);
    return { user_id: r.user_id };
  },
}));
const realWsServer = await import("@/lib/ws-server");
mock.module("@/lib/ws-server", () => ({
  ...realWsServer,
  postInternalBroadcast: async (userId: string, type: string, payload: Record<string, unknown>) => {
    broadcasts.push({ userId, type, payload });
  },
}));

let app: Hono;
// rest-api caches instance owners per process, so each test gets fresh ids.
let testNo = 0;
let A: string;
let B: string;

beforeAll(async () => {
  // The real instance router, so auth and route order are tested too.
  const { default: obsNodeInstances } = await import("@/routes/obs-node-instances");
  app = new Hono();
  app.route("/instances", obsNodeInstances);
});

const postEvent = (id: string, body: unknown, key: string | null = NODE_A_KEY) =>
  app.request(`/instances/${id}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  testNo++;
  // Fresh ids per test (the owner cache is module state).
  A = `aaaaaaaa-0000-4000-8000-${String(testNo).padStart(12, "0")}`;
  B = `bbbbbbbb-0000-4000-8000-${String(testNo).padStart(12, "0")}`;
  rows = new Map([
    [A, { node_id: "node-a", user_id: "user-1" }],
    [B, { node_id: "node-b", user_id: "user-2" }],
  ]);
  broadcasts = [];
  ownerLookups = 0;
});

describe("POST /instances/:id/events", () => {
  it("forwards a lifecycle event to the instance owner", async () => {
    const at = "2026-11-02T10:00:00.000Z";
    const res = await postEvent(A, { type: "lifecycle", action: "started", at });
    expect(res.status).toBe(202);
    expect(broadcasts).toEqual([
      {
        userId: "user-1",
        type: "streamwizard.obs_instance_lifecycle",
        payload: { instanceId: A, action: "started", at },
      },
    ]);
  });

  it("forwards a scene change to the instance owner", async () => {
    const res = await postEvent(A, { type: "scene_changed", sceneName: "BRB", sceneUuid: "uuid-1" });
    expect(res.status).toBe(202);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]!.userId).toBe("user-1");
    expect(broadcasts[0]!.type).toBe("streamwizard.obs_scene_changed");
    expect(broadcasts[0]!.payload).toMatchObject({ instanceId: A, sceneName: "BRB", sceneUuid: "uuid-1" });
    expect(typeof broadcasts[0]!.payload.at).toBe("string");
  });

  it("the owner comes from the database, never from the body", async () => {
    const res = await postEvent(A, { type: "lifecycle", action: "stopped", userId: "user-2" });
    expect(res.status).toBe(202);
    expect(broadcasts[0]!.userId).toBe("user-1");
  });

  it("404s another node's instance, same as a missing one, and sends nothing", async () => {
    expect((await postEvent(B, { type: "lifecycle", action: "started" })).status).toBe(404);
    expect((await postEvent("missing", { type: "lifecycle", action: "started" })).status).toBe(404);
    expect(broadcasts).toEqual([]);
  });

  it("refuses event types and actions the node may not send", async () => {
    const bad = [
      { type: "channel.follow" },
      { type: "lifecycle", action: "deleted" },
      { type: "lifecycle", action: "anything" },
      { type: "scene_changed", sceneName: "", sceneUuid: "u" },
      { type: "lifecycle", action: "started", at: "yesterday" },
    ];
    for (const body of bad) expect((await postEvent(A, body)).status).toBe(400);
    expect((await postEvent(A, "{not json")).status).toBe(400);
    expect(broadcasts).toEqual([]);
  });

  it("needs a node API key", async () => {
    expect((await postEvent(A, { type: "lifecycle", action: "started" }, null)).status).toBe(401);
    expect((await postEvent(A, { type: "lifecycle", action: "started" }, "wrong")).status).toBe(401);
    expect(broadcasts).toEqual([]);
  });
});

describe("owner cache", () => {
  it("looks the owner up once, then serves later events from memory", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await postEvent(A, { type: "scene_changed", sceneName: `S${i}`, sceneUuid: `u${i}` })).status).toBe(202);
    }
    expect(ownerLookups).toBe(1);
    expect(broadcasts.map((b) => b.userId)).toEqual(["user-1", "user-1", "user-1"]);
  });

  it("keys on the node too, so a cached owner never leaks to another node", async () => {
    expect((await postEvent(A, { type: "lifecycle", action: "started" })).status).toBe(202);
    expect((await postEvent(A, { type: "lifecycle", action: "started" }, NODE_B_KEY)).status).toBe(404);
    expect(broadcasts).toHaveLength(1);
  });

  it("forgets the owner when the node deletes the instance", async () => {
    expect((await postEvent(A, { type: "lifecycle", action: "stopped" })).status).toBe(202);
    await app.request(`/instances/${A}`, { method: "DELETE", headers: { Authorization: `Bearer ${NODE_A_KEY}` } });
    broadcasts = [];
    expect((await postEvent(A, { type: "lifecycle", action: "started" })).status).toBe(404);
    expect(broadcasts).toEqual([]);
  });
});

describe("DELETE /instances/:id", () => {
  it("tells the owner the instance was deleted", async () => {
    const res = await app.request(`/instances/${A}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${NODE_A_KEY}` },
    });
    expect(res.status).toBe(200);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]!).toMatchObject({
      userId: "user-1",
      type: "streamwizard.obs_instance_lifecycle",
      payload: { instanceId: A, action: "deleted" },
    });
  });

  it("sends nothing when the instance is on another node", async () => {
    const res = await app.request(`/instances/${B}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${NODE_A_KEY}` },
    });
    expect(res.status).toBe(404);
    expect(broadcasts).toEqual([]);
  });
});
