import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, setSystemTime } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";

// GET /api/ingest-nodes/live-sessions/:session_id against in-memory session
// rows, stream keys and plans. Rows are encrypted with the real crypto.

process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");

const NODE_A_KEY = `live-lookup-node-a-${randomBytes(8).toString("hex")}`;
const NODE_B_KEY = `live-lookup-node-b-${randomBytes(8).toString("hex")}`;
const NODE_A = "aaaaaaaa-0000-4000-8000-0000000000e1";
const NODE_B = "bbbbbbbb-0000-4000-8000-0000000000e2";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const nodeByKeyHash = new Map([
  [hash(NODE_A_KEY), NODE_A],
  [hash(NODE_B_KEY), NODE_B],
]);

const USER = "0e0e0000-0000-4000-8000-0000000000e1";
const KEY_ID = "4e440000-0000-4000-8000-0000000000e1";
const WIRE_ID = "9f3c2a71e04b5d18";
const SECRET = Buffer.from(randomBytes(32)).toString("base64url");
const NOW = new Date("2026-11-20T10:00:00.000Z");

type Row = {
  wire_id: string;
  user_id: string;
  key_id: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
  protocol_version: number;
  expires_at: string;
  ended_at: string | null;
  revoked_at: string | null;
};
let rows: Map<string, Row>;
let keyActive: boolean;
let planActive: boolean;
let lookups: number;

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@/env", () => ({
  env: { NODE_TOKEN_PUBLIC_JWKS: undefined, WS_SERVER_URL: undefined, LIVE_INGEST_ENDPOINTS: [] },
}));
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/ingest/nodes");
mock.module("@repo/supabase/queries/ingest/nodes", () => ({
  ...realNodeQueries,
  lookupIngestNodeByApiKeyHash: async (_c: unknown, keyHash: string) => nodeByKeyHash.get(keyHash) ?? null,
}));
const realIngest = await import("@repo/supabase/queries/ingest/ingest");
mock.module("@repo/supabase/queries/ingest/ingest", () => ({
  ...realIngest,
  getOutputKeysForKey: async (_c: unknown, keyId: string) => ({
    data: keyId === KEY_ID ? [{ output_key: "out-1" }, { output_key: "out-2" }] : [],
    error: null,
  }),
}));
const realSubscriptions = await import("@repo/supabase/queries/subscriptions/subscriptions");
mock.module("@repo/supabase/queries/subscriptions/subscriptions", () => ({
  ...realSubscriptions,
  getUserActiveSubscriptionId: async (_c: unknown, user: string, product: string) =>
    planActive && user === USER && product === "cloud_obs" ? "sub-1" : null,
}));
const realLive = await import("@repo/supabase/queries/ingest/live-sessions");
mock.module("@repo/supabase/queries/ingest/live-sessions", () => ({
  ...realLive,
  getLiveSessionByWireId: async (_c: unknown, wireId: string) => {
    lookups++;
    const row = rows.get(wireId);
    return row ? { ...row, key_is_active: keyActive } : null;
  },
}));

let app: Hono;
let resetLiveSessionMisses: () => void;
let encryptToken: typeof import("@repo/supabase/crypto").encryptToken;

beforeAll(async () => {
  const { ingestNodeRoutes } = await import("@/modules/ingest-nodes/routes");
  ({ resetLiveSessionMisses } = await import("./live-sessions"));
  ({ encryptToken } = await import("@repo/supabase/crypto"));
  app = new Hono();
  app.route("/api/ingest-nodes", ingestNodeRoutes);
});

beforeEach(() => {
  setSystemTime(NOW);
  const enc = encryptToken(SECRET);
  rows = new Map([
    [
      WIRE_ID,
      {
        wire_id: WIRE_ID,
        user_id: USER,
        key_id: KEY_ID,
        secret_ciphertext: enc.ciphertext,
        secret_iv: enc.iv,
        secret_tag: enc.authTag,
        protocol_version: 1,
        expires_at: "2026-11-21T10:00:00+00:00",
        ended_at: null,
        revoked_at: null,
      },
    ],
  ]);
  keyActive = true;
  planActive = true;
  lookups = 0;
  resetLiveSessionMisses();
});

afterEach(() => {
  setSystemTime();
});

const lookup = (sessionId: string, key: string | null = NODE_A_KEY) =>
  app.request(`/api/ingest-nodes/live-sessions/${sessionId}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });

const expectNotFound = async (res: Response) => {
  expect(res.status).toBe(404);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ error: "Session not found" });
};

describe("GET /live-sessions/:session_id", () => {
  it("returns the session, its decrypted secret, owner and output keys", async () => {
    const res = await lookup(WIRE_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      session_id: WIRE_ID,
      session_secret: SECRET,
      protocol_version: 1,
      user_id: USER,
      stream_key_id: KEY_ID,
      output_keys: ["out-1", "out-2"],
      expires_at: "2026-11-21T10:00:00.000Z",
    });
  });

  it("404 for an unknown session", async () => {
    await expectNotFound(await lookup("00000000000000ff"));
  });

  it("404 for a malformed id, without a database lookup", async () => {
    for (const id of ["9F3C2A71E04B5D18", "9f3c2a71e04b5d1", "9f3c2a71e04b5d18a", "0000000000000000", "not-hex-at-all!!"]) {
      await expectNotFound(await lookup(id));
    }
    expect(lookups).toBe(0);
  });

  it("404 once the session expired", async () => {
    setSystemTime(new Date("2026-11-21T09:59:59.000Z"));
    expect((await lookup(WIRE_ID)).status).toBe(200);
    setSystemTime(new Date("2026-11-21T10:00:00.000Z"));
    await expectNotFound(await lookup(WIRE_ID));
  });

  it("404 for an ended session", async () => {
    rows.get(WIRE_ID)!.ended_at = NOW.toISOString();
    await expectNotFound(await lookup(WIRE_ID));
  });

  it("404 for a revoked session", async () => {
    rows.get(WIRE_ID)!.revoked_at = NOW.toISOString();
    await expectNotFound(await lookup(WIRE_ID));
  });

  it("404 when the stream key was turned off", async () => {
    keyActive = false;
    await expectNotFound(await lookup(WIRE_ID));
  });

  it("404 when the owner lost the Cloud OBS plan", async () => {
    planActive = false;
    await expectNotFound(await lookup(WIRE_ID));
  });

  it("500 without the secret when it can't be decrypted", async () => {
    rows.get(WIRE_ID)!.secret_tag = Buffer.alloc(16).toString("base64");
    const res = await lookup(WIRE_ID);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(SECRET);
  });

  it("needs a node API key", async () => {
    expect((await lookup(WIRE_ID, null)).status).toBe(401);
    expect((await lookup(WIRE_ID, "not-a-node-key")).status).toBe(401);
    expect(lookups).toBe(0);
  });
});

describe("miss limit", () => {
  it("a node that keeps missing is blocked, other nodes are not", async () => {
    for (let i = 0; i < 60; i++) {
      expect((await lookup(`ffffffff${String(i).padStart(8, "0")}`)).status).toBe(404);
    }
    const blocked = await lookup(WIRE_ID);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBe(600);
    expect((await lookup(WIRE_ID, NODE_B_KEY)).status).toBe(200);
    // The window ends.
    setSystemTime(new Date(NOW.getTime() + 10 * 60 * 1000 + 1000));
    expect((await lookup(WIRE_ID)).status).toBe(200);
  });

  it("malformed ids count as misses", async () => {
    for (let i = 0; i < 60; i++) await lookup("nope");
    expect((await lookup(WIRE_ID)).status).toBe(429);
  });

  it("sessions it is allowed to serve don't use up the limit", async () => {
    for (let i = 0; i < 100; i++) expect((await lookup(WIRE_ID)).status).toBe(200);
  });

  it("parallel misses can't slip past the limit", async () => {
    const results = await Promise.all(Array.from({ length: 70 }, () => lookup("00000000000000ff")));
    expect(results.filter((r) => r.status === 404)).toHaveLength(60);
    expect(results.filter((r) => r.status === 429)).toHaveLength(10);
  });
});
