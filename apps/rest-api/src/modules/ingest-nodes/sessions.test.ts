import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";

const NODE_A_KEY = `ingest-test-node-a-${randomBytes(8).toString("hex")}`;
const NODE_B_KEY = `ingest-test-node-b-${randomBytes(8).toString("hex")}`;
const NODE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const NODE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const nodeByKeyHash = new Map([
  [hash(NODE_A_KEY), NODE_A],
  [hash(NODE_B_KEY), NODE_B],
]);

const USER = "0e0e0000-0000-4000-8000-000000000001";
const KEY_ID = "4e440000-0000-4000-8000-000000000001";

type SessionRow = { id: string; user_id: string; node_id: string; key_id: string; ended_at: string | null; last_bitrate_kbps: number | null };
let sessions: Map<string, SessionRow>;
let statsInserted: Record<string, unknown>[];
let registered: unknown[];
let unregistered: string[];
let broadcasts: { userId: string; type: string; payload: unknown }[];
let registerFails: boolean;
let nextId: number;
let deletedNodes: Set<string>;

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@/env", () => ({
  env: { NODE_TOKEN_PUBLIC_JWKS: undefined, WS_SERVER_URL: "ws://ws.test" },
}));
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/ingest-nodes");
mock.module("@repo/supabase/queries/ingest-nodes", () => ({
  ...realNodeQueries,
  lookupIngestNodeByApiKeyHash: async (_c: unknown, keyHash: string) => nodeByKeyHash.get(keyHash) ?? null,
  getIngestNodeById: async (_c: unknown, id: string) => (deletedNodes.has(id) ? null : { id, status: "linked" }),
}));
const realIngest = await import("@repo/supabase/queries/ingest");
mock.module("@repo/supabase/queries/ingest", () => ({
  ...realIngest,
  getStreamKeyOwner: async (_c: unknown, key: string) =>
    key === "good-key" ? { user_id: USER, key_id: KEY_ID, label: "Camera 1" } : null,
  touchStreamKey: async () => {},
  getOutputKeysForKey: async () => ({ data: [{ output_key: "out-1" }, { output_key: "out-2" }], error: null }),
  insertIngestSession: async (_c: unknown, row: Omit<SessionRow, "id" | "ended_at" | "last_bitrate_kbps">) => {
    const id = `5e550000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`;
    sessions.set(id, { ...row, id, ended_at: null, last_bitrate_kbps: null });
    return { data: { id }, error: null };
  },
  endIngestSession: async (_c: unknown, id: string, nodeId: string, bitrate: number | null) => {
    const row = sessions.get(id);
    if (!row || row.node_id !== nodeId) return null;
    if (row.ended_at) return { user_id: row.user_id, endedNow: false };
    Object.assign(row, { ended_at: "now", last_bitrate_kbps: bitrate });
    return { user_id: row.user_id, endedNow: true };
  },
  getIngestSessionOwnersForNode: async (_c: unknown, ids: string[], nodeId: string) =>
    new Map(ids.flatMap((id) => (sessions.get(id)?.node_id === nodeId ? [[id, sessions.get(id)!.user_id]] : []))),
  insertIngestSessionStatsBatch: async (_c: unknown, rows: Record<string, unknown>[]) => {
    statsInserted.push(...rows);
    return { error: null };
  },
}));
const realWsClient = await import("@repo/ws-client");
mock.module("@repo/ws-client", () => ({
  ...realWsClient,
  registerIngestSession: async (session: unknown) => {
    registered.push(session);
    return registerFails ? { ok: false, reason: "network", error: new Error("down") } : { ok: true };
  },
  endIngestSessionOnWs: async (id: string) => {
    unregistered.push(id);
    return { ok: true };
  },
  broadcastToUser: async (userId: string, type: string, payload: unknown) => {
    broadcasts.push({ userId, type, payload });
    return { ok: true };
  },
}));

let app: Hono;
let service: typeof import("@repo/service-token");
let resetKeyFailures: () => void;
let publicKey: Record<string, unknown>;

beforeAll(async () => {
  const { ingestNodeRoutes } = await import("@/modules/ingest-nodes/routes");
  ({ resetKeyFailures } = await import("./sessions"));
  service = await import("@repo/service-token");
  app = new Hono();
  app.route("/api/ingest-nodes", ingestNodeRoutes);

  const pair = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const pub = await exportJWK(pair.publicKey);
  const kid = await calculateJwkThumbprint(pub);
  process.env.WS_SERVICE_SIGNING_JWK = JSON.stringify({ ...(await exportJWK(pair.privateKey)), kid, alg: "EdDSA", svc: "rest-api" });
  publicKey = { ...pub, kid, alg: "EdDSA", svc: "rest-api" };
});

beforeEach(async () => {
  sessions = new Map();
  statsInserted = [];
  registered = [];
  unregistered = [];
  broadcasts = [];
  registerFails = false;
  nextId = 0;
  deletedNodes = new Set();
  resetKeyFailures();
  service.resetSigningKey();
  const { env } = await import("@/env");
  (env as Record<string, unknown>).WS_SERVER_URL = "ws://ws.test";
});

const settle = () => new Promise((r) => setTimeout(r, 0));
const post = (path: string, body: unknown, key: string | null = NODE_A_KEY) =>
  app.request(`/api/ingest-nodes${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  });
const open = (key = NODE_A_KEY) => post("/sessions", { protocol: "srt", stream_key: "good-key", remote_ip: "10.0.0.1" }, key);

describe("POST /sessions", () => {
  it("opens a session on the calling node and registers it with ws-server", async () => {
    const res = await open();
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown> & { session_id: string };
    expect(body).toEqual({
      session_id: body.session_id,
      user_id: USER,
      stream_key_id: KEY_ID,
      label: "Camera 1",
      output_keys: ["out-1", "out-2"],
    });
    expect(sessions.get(body.session_id)!.node_id).toBe(NODE_A);
    expect(registered).toEqual([{ session_id: body.session_id, user_id: USER, node_id: NODE_A, stream_key_id: KEY_ID, label: "Camera 1" }]);
  });

  it("an unknown key gets 403 and opens nothing", async () => {
    const res = await post("/sessions", { protocol: "srt", stream_key: "nope" });
    expect(res.status).toBe(403);
    expect(sessions.size).toBe(0);
  });

  it("a failed ws-server registration doesn't fail the open", async () => {
    registerFails = true;
    expect((await open()).status).toBe(201);
  });

  it("a node that keeps guessing keys is blocked, other nodes are not", async () => {
    for (let i = 0; i < 30; i++) await post("/sessions", { protocol: "srt", stream_key: `guess-${i}` });
    expect((await open()).status).toBe(429);
    expect((await open(NODE_B_KEY)).status).toBe(201);
  });

  it("parallel guesses can't slip past the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => post("/sessions", { protocol: "srt", stream_key: `guess-${i}` })),
    );
    expect(results.filter((r) => r.status === 403)).toHaveLength(30);
    expect(results.filter((r) => r.status === 429)).toHaveLength(10);
  });

  it("valid keys don't use up the limit", async () => {
    for (let i = 0; i < 40; i++) expect((await open()).status).toBe(201);
  });

  it("needs a node API key and a valid body", async () => {
    expect((await post("/sessions", { protocol: "srt", stream_key: "good-key" }, null)).status).toBe(401);
    expect((await post("/sessions", { protocol: "webrtc", stream_key: "good-key" })).status).toBe(400);
  });
});

describe("POST /sessions/:id/end", () => {
  it("ends the node's own session, unregisters it and tells the auto-switcher", async () => {
    const { session_id } = (await (await open()).json()) as { session_id: string };
    expect((await post(`/sessions/${session_id}/end`, { last_bitrate_kbps: 4500.4 })).status).toBe(200);
    await settle();
    expect(sessions.get(session_id)!.last_bitrate_kbps).toBe(4500);
    expect(unregistered).toEqual([session_id]);
    expect(broadcasts).toEqual([
      { userId: USER, type: "streamwizard.ingest_session_ended", payload: { session_id, node_id: NODE_A } },
    ]);
  });

  it("is idempotent: a second end changes nothing and doesn't broadcast again", async () => {
    const { session_id } = (await (await open()).json()) as { session_id: string };
    await post(`/sessions/${session_id}/end`, { last_bitrate_kbps: 100 });
    expect((await post(`/sessions/${session_id}/end`, { last_bitrate_kbps: 999 })).status).toBe(200);
    await settle();
    expect(sessions.get(session_id)!.last_bitrate_kbps).toBe(100);
    expect(broadcasts).toHaveLength(1);
  });

  it("another node's session gets the same 404 as a missing one", async () => {
    const { session_id } = (await (await open()).json()) as { session_id: string };
    expect((await post(`/sessions/${session_id}/end`, { last_bitrate_kbps: null }, NODE_B_KEY)).status).toBe(404);
    expect((await post("/sessions/5e550000-0000-4000-8000-0000000000ff/end", { last_bitrate_kbps: null })).status).toBe(404);
    expect((await post("/sessions/not-a-uuid/end", { last_bitrate_kbps: null })).status).toBe(404);
    expect(sessions.get(session_id)!.ended_at).toBeNull();
  });
});

describe("POST /session-stats", () => {
  it("keeps rows for the node's own sessions, fills user_id, drops the rest", async () => {
    const { session_id: mine } = (await (await open()).json()) as { session_id: string };
    const { session_id: theirs } = (await (await open(NODE_B_KEY)).json()) as { session_id: string };
    const row = (session_id: string) => ({ session_id, protocol: "srt", recorded_at: "2026-11-02T10:00:00.000Z", kbps: 4000 });
    const res = await post("/session-stats", {
      rows: [row(mine), row(theirs), row("5e550000-0000-4000-8000-0000000000ff"), row(mine)],
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, inserted: 2 });
    expect(statsInserted.map((r) => [r.session_id, r.user_id])).toEqual([
      [mine, USER],
      [mine, USER],
    ]);
  });

  it("accepts rows for a session that already ended", async () => {
    const { session_id } = (await (await open()).json()) as { session_id: string };
    await post(`/sessions/${session_id}/end`, { last_bitrate_kbps: null });
    const res = await post("/session-stats", { rows: [{ session_id, protocol: "srt", recorded_at: "2026-11-02T10:00:00.000Z" }] });
    expect(await res.json()).toEqual({ ok: true, inserted: 1 });
  });

  it("refuses an oversized batch", async () => {
    const rows = Array.from({ length: 5001 }, () => ({
      session_id: "5e550000-0000-4000-8000-000000000001",
      protocol: "srt",
      recorded_at: "2026-11-02T10:00:00.000Z",
    }));
    expect((await post("/session-stats", { rows })).status).toBe(400);
  });
});

describe("POST /me/ws-token", () => {
  it("returns a token for this node, scope ingest-node, and the ws base url", async () => {
    const { env } = await import("@/env");
    (env as Record<string, unknown>).WS_SERVER_URL = "https://ws.example.com/ws/";
    const res = await post("/me/ws-token", {});
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { token: string; ws_server_url: string };
    expect(body.ws_server_url).toBe("wss://ws.example.com");
    const verify = service.createServiceTokenVerifier({ keys: [publicKey as never] });
    expect(await verify(body.token, "ingest-node")).toEqual({ service: "rest-api", claims: { node: NODE_A } });
  });

  it("prefers the node-facing ws-server address when one is set", async () => {
    const { env } = await import("@/env");
    Object.assign(env as Record<string, unknown>, { WS_SERVER_URL: "ws://localhost:8000", WS_SERVER_NODE_URL: "ws://host.docker.internal:8000" });
    try {
      const body = (await (await post("/me/ws-token", {})).json()) as { ws_server_url: string };
      expect(body.ws_server_url).toBe("ws://host.docker.internal:8000");
    } finally {
      (env as Record<string, unknown>).WS_SERVER_NODE_URL = undefined;
    }
  });

  it("404 for a node that was deleted, even while its key is still cached", async () => {
    deletedNodes.add(NODE_A);
    expect((await post("/me/ws-token", {})).status).toBe(404);
  });

  it("404 when this environment has no ws-server", async () => {
    const { env } = await import("@/env");
    (env as Record<string, unknown>).WS_SERVER_URL = undefined;
    expect((await post("/me/ws-token", {})).status).toBe(404);
  });

  it("404 when rest-api has no service signing key", async () => {
    const saved = process.env.WS_SERVICE_SIGNING_JWK;
    delete process.env.WS_SERVICE_SIGNING_JWK;
    try {
      expect((await post("/me/ws-token", {})).status).toBe(404);
    } finally {
      process.env.WS_SERVICE_SIGNING_JWK = saved;
    }
  });
});
