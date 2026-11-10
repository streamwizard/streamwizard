import { describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "development";
process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SECRET_KEY ??= "test-secret";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-key";

// The /internal/* bodies are parsed after the service token check. The check
// itself is covered in middleware/service-auth.test.ts; here every caller is
// let through, keeping the module's other exports (mocks are process-wide).
mock.module("@repo/supabase", () => ({ supabase: {} }));
const realAuth = await import("@/middleware/service-auth");
mock.module("@/middleware/service-auth", () => ({
  ...realAuth,
  serviceAuthConfigured: () => true,
  authorizeService: async () => ({ ok: true, service: "rest-api", claims: {} }),
}));

const { broadcastRoutes } = await import("./broadcast/routes");
const { revokeRoutes } = await import("./revoke/routes");
const { ingestRoutes } = await import("./ingest/routes");
const { ingestSessions } = await import("./ingest/sessions");
const { rooms } = await import("./rooms/rooms");

const ID = "5e550000-0000-4000-8000-000000000001";
const NODE = "aaaaaaaa-0000-4000-8000-000000000001";

function post(path: string, body: unknown): Request {
  return new Request(`http://ws.local${path}`, {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /internal/broadcast", () => {
  const send = (body: unknown) => broadcastRoutes(post("/internal/broadcast", body), "/internal/broadcast")!;

  test("a valid body reaches the room, with only type and payload", async () => {
    const got: string[] = [];
    rooms.set("u-internal", { subscribers: new Set([{ data: { channels: new Set() }, send: (m: string) => got.push(m) }]) } as never);
    try {
      const res = await send({ userId: "u-internal", type: "channel.follow", payload: { a: 1 }, extra: "dropped" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, delivered: true });
    } finally {
      rooms.delete("u-internal");
    }
    expect(got.map((m) => JSON.parse(m))).toEqual([{ type: "channel.follow", payload: { a: 1 } }]);
  });

  test("bad JSON and bad shapes get a plain 400 that doesn't say why", async () => {
    for (const body of ["{nope", { type: "channel.follow" }, { userId: "u", type: "" }, { userId: "u".repeat(129), type: "t" }]) {
      const res = await send(body);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Bad Request");
    }
  });
});

describe("POST /internal/revoke", () => {
  const send = (body: unknown) => revokeRoutes(post("/internal/revoke", body), "/internal/revoke")!;

  test("a known scope is accepted", async () => {
    const res = await send({ userId: "nobody-connected", scope: "session" });
    expect(await res.json()).toEqual({ ok: true, closed: 0 });
  });

  test("an unknown scope or missing user is a 400", async () => {
    expect((await send({ userId: "u", scope: "everything" })).status).toBe(400);
    expect((await send({ scope: "all" })).status).toBe(400);
  });

  test("an ingest node revoke needs a UUID", async () => {
    const path = (id: string) => `/internal/ingest-nodes/${id}/revoke`;
    expect((await revokeRoutes(post(path(NODE), {}), path(NODE))!).status).toBe(200);
    expect((await revokeRoutes(post(path("node-1"), {}), path("node-1"))!).status).toBe(400);
  });
});

describe("POST /internal/ingest-sessions", () => {
  const register = (body: unknown) => ingestRoutes(post("/internal/ingest-sessions", body), "/internal/ingest-sessions")!;
  const body = { session_id: ID, user_id: ID, node_id: NODE, stream_key_id: ID, label: "Camera 1" };

  test("a valid registration is stored and the session can end", async () => {
    expect((await register({ ...body, extra: 1 })).status).toBe(200);
    const session = await ingestSessions.resolve(ID, NODE);
    expect(session).toMatchObject({ userId: ID, nodeId: NODE, streamKeyId: ID, label: "Camera 1" });

    const end = `/internal/ingest-sessions/${ID}/end`;
    expect((await ingestRoutes(post(end, {}), end)!).status).toBe(200);
    expect((await ingestSessions.resolve(ID, NODE))?.endedAt).toBeDefined();
  });

  test("non-UUID ids are a 400", async () => {
    expect((await register({ ...body, node_id: "node-1" })).status).toBe(400);
    expect((await register("[]")).status).toBe(400);
    const end = "/internal/ingest-sessions/not-a-uuid/end";
    expect((await ingestRoutes(post(end, {}), end)!).status).toBe(400);
  });
});
