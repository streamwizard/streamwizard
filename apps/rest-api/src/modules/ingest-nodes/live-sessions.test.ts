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
  created_at: string;
  expires_at: string;
  ended_at: string | null;
  revoked_at: string | null;
};
let rows: Map<string, Row>;
let keyActive: boolean;
let planActive: boolean;
let lookups: number;
/** While set, every session read waits for it: lets a test hold parallel requests at the read. */
let readGate: Promise<void> | null = null;
/** reportError calls. Never printed: a report must not carry a secret anyway. */
let reports: { context: string; message: string; extra: Record<string, unknown> | undefined }[] = [];

mock.module("@repo/supabase", () => ({ supabase: {} }));
// Spread the real exports: bun shares module mocks across test files.
const realSentry = await import("@repo/sentry");
mock.module("@repo/sentry", () => ({
  ...realSentry,
  reportError: (error: unknown, context: string, extra?: Record<string, unknown>) => {
    reports.push({ context, message: error instanceof Error ? error.message : String(error), extra });
  },
}));
mock.module("@/env", () => ({
  env: { NODE_TOKEN_PUBLIC_JWKS: undefined, WS_SERVER_URL: undefined, LIVE_INGEST_ENDPOINTS: [], LIVE_LATENCY_MS: 2000 },
}));
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
    if (readGate) await readGate;
    const row = rows.get(wireId);
    return row ? { ...row, key_is_active: keyActive } : null;
  },
}));

let app: Hono;
let resetLiveSessionLookupLimits: () => void;
let encryptToken: typeof import("@repo/supabase/crypto").encryptToken;

beforeAll(async () => {
  const { ingestNodeRoutes } = await import("@/modules/ingest-nodes/routes");
  ({ resetLiveSessionLookupLimits } = await import("./live-sessions"));
  ({ encryptToken } = await import("@repo/supabase/crypto"));
  app = new Hono();
  app.route("/api/ingest-nodes", ingestNodeRoutes);
});

beforeEach(async () => {
  // bun shares module mocks across test files: set what this file needs.
  const { env } = await import("@/env");
  (env as Record<string, unknown>).LIVE_LATENCY_MS = 2000;
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
        // Postgres timestamptz text, as PostgREST returns it.
        created_at: "2026-11-20T09:59:58.123456+00:00",
        expires_at: "2026-11-21T10:00:00+00:00",
        ended_at: null,
        revoked_at: null,
      },
    ],
  ]);
  keyActive = true;
  planActive = true;
  lookups = 0;
  readGate = null;
  reports = [];
  resetLiveSessionLookupLimits();
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
      created_at: "2026-11-20T09:59:58.123Z",
      expires_at: "2026-11-21T10:00:00.000Z",
      latency_ms: 2000,
    });
  });

  it("states the latency budget from LIVE_LATENCY_MS", async () => {
    const { env } = await import("@/env");
    (env as Record<string, unknown>).LIVE_LATENCY_MS = 4000;
    const res = await lookup(WIRE_ID);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { latency_ms: number }).latency_ms).toBe(4000);
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

const unknownId = (i: number) => `ffffffff${String(i).padStart(8, "0")}`;
const missN = async (n: number, key = NODE_A_KEY) => {
  const statuses: number[] = [];
  for (let i = 0; i < n; i++) statuses.push((await lookup(unknownId(i), key)).status);
  return statuses;
};
/** NOW plus `ms`. */
const after = (ms: number) => new Date(NOW.getTime() + ms);
const missLimitReports = () => reports.filter((r) => r.context === "live-sessions.miss-limit");

// Checks the secret without ever printing it, even when the check fails.
const expectServed = async (res: Response) => {
  expect(res.status).toBe(200);
  const body = (await res.json()) as { session_id: string; session_secret: string };
  expect(body.session_id).toBe(WIRE_ID);
  expect(body.session_secret === SECRET).toBe(true);
};

const expectTooMany = async (res: Response, error: "Too many unknown sessions" | "Too many requests") => {
  expect(res.status).toBe(429);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ error });
  return Number(res.headers.get("retry-after"));
};

/** Starts every request and holds them at the session read until `reads` wait there, then lets them all go. */
async function inParallel(requests: (() => Response | Promise<Response>)[], reads: number): Promise<Response[]> {
  let open = () => {};
  readGate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const start = lookups;
  const pending = requests.map((r) => r());
  // performance.now: Date is frozen by setSystemTime.
  const deadline = performance.now() + 1000;
  while (lookups - start < reads && performance.now() < deadline) await Bun.sleep(1);
  readGate = null;
  open();
  expect(lookups - start).toBe(reads);
  return Promise.all(pending);
}

describe("miss limit", () => {
  it("after 60 misses a valid session is still served, and doesn't change the count", async () => {
    expect((await missN(60)).every((s) => s === 404)).toBe(true);
    for (let i = 0; i < 10; i++) await expectServed(await lookup(WIRE_ID));
    expect(await expectTooMany(await lookup(unknownId(99)), "Too many unknown sessions")).toBe(600);
  });

  it("over the limit a miss gets 429 until the window ends, then 404 again", async () => {
    await missN(60);
    expect(await expectTooMany(await lookup(unknownId(60)), "Too many unknown sessions")).toBe(600);
    // Retry-After is the time left in the window, rounded up.
    setSystemTime(after(270_500));
    expect(await expectTooMany(await lookup(unknownId(61)), "Too many unknown sessions")).toBe(330);
    setSystemTime(after(599_001));
    expect(await expectTooMany(await lookup(unknownId(62)), "Too many unknown sessions")).toBe(1);
    // The window runs from the first miss; refused misses didn't extend it.
    setSystemTime(after(600_000));
    await expectNotFound(await lookup(unknownId(63)));
    // A new window: 59 more misses allowed, then 429 again.
    expect((await missN(59)).every((s) => s === 404)).toBe(true);
    expect(await expectTooMany(await lookup(unknownId(64)), "Too many unknown sessions")).toBe(600);
  });

  it("every kind of miss looks the same over the limit", async () => {
    await missN(60);
    const refused = async () => expectTooMany(await lookup(WIRE_ID), "Too many unknown sessions");
    rows.get(WIRE_ID)!.ended_at = NOW.toISOString();
    await refused();
    rows.get(WIRE_ID)!.ended_at = null;
    rows.get(WIRE_ID)!.revoked_at = NOW.toISOString();
    await refused();
    rows.get(WIRE_ID)!.revoked_at = null;
    keyActive = false;
    await refused();
    keyActive = true;
    planActive = false;
    await refused();
    planActive = true;
    await expectTooMany(await lookup("nope"), "Too many unknown sessions");
    await expectServed(await lookup(WIRE_ID));
    setSystemTime(new Date("2026-11-21T10:00:00.000Z"));
    await expectNotFound(await lookup(WIRE_ID)); // expired; also a new miss window
  });

  it("malformed ids count as misses", async () => {
    for (let i = 0; i < 60; i++) await expectNotFound(await lookup("nope"));
    await expectTooMany(await lookup(unknownId(0)), "Too many unknown sessions");
    await expectServed(await lookup(WIRE_ID));
  });

  it("sessions it may serve don't use up the limit", async () => {
    for (let i = 0; i < 100; i++) expect((await lookup(WIRE_ID)).status).toBe(200);
    setSystemTime(after(4000)); // the request limit refills
    expect((await missN(60)).every((s) => s === 404)).toBe(true);
    await expectTooMany(await lookup(unknownId(60)), "Too many unknown sessions");
  });

  it("other nodes are not affected", async () => {
    await missN(60);
    await expectTooMany(await lookup(unknownId(60)), "Too many unknown sessions");
    expect((await missN(60, NODE_B_KEY)).every((s) => s === 404)).toBe(true);
    await expectServed(await lookup(WIRE_ID, NODE_B_KEY));
  });

  it("reports once per node and window, with the node id only", async () => {
    await missN(60);
    expect(missLimitReports()).toHaveLength(0);
    for (let i = 0; i < 5; i++) await lookup(unknownId(60 + i));
    await lookup("nope");
    expect(missLimitReports()).toEqual([
      {
        context: "live-sessions.miss-limit",
        message: "ingest node over its live session miss limit",
        extra: { node_id: NODE_A },
      },
    ]);

    // Node B has its own window and its own report.
    await missN(60, NODE_B_KEY);
    expect(missLimitReports()).toHaveLength(1);
    await lookup(unknownId(60), NODE_B_KEY);
    await lookup(unknownId(61), NODE_B_KEY);
    expect(missLimitReports().map((r) => r.extra)).toEqual([{ node_id: NODE_A }, { node_id: NODE_B }]);

    // A later window that hits the limit again reports again, once.
    setSystemTime(after(600_000));
    expect((await missN(60)).every((s) => s === 404)).toBe(true);
    expect(missLimitReports()).toHaveLength(2);
    await lookup(unknownId(60));
    await lookup(unknownId(61));
    expect(missLimitReports().map((r) => r.extra)).toEqual([
      { node_id: NODE_A },
      { node_id: NODE_B },
      { node_id: NODE_A },
    ]);

    // Nothing secret or looked up in any report.
    const text = JSON.stringify(reports);
    for (const s of [SECRET, NODE_A_KEY, NODE_B_KEY, unknownId(60), "nope"]) expect(text.includes(s)).toBe(false);
  });

  it("parallel misses can't slip past the limit", async () => {
    const results = await inParallel(
      Array.from({ length: 100 }, (_, i) => () => lookup(unknownId(i))),
      100,
    );
    expect(results.filter((r) => r.status === 404)).toHaveLength(60);
    expect(results.filter((r) => r.status === 429)).toHaveLength(40);
    expect(missLimitReports()).toHaveLength(1);
  });

  it("parallel valid lookups mixed in are all served and don't change the count", async () => {
    // 70 misses and 20 valid lookups, interleaved, all waiting at the read at once.
    const kinds = Array.from({ length: 90 }, (_, i) => i % 9 === 4 || i % 9 === 8);
    const results = await inParallel(
      kinds.map((valid, i) => () => lookup(valid ? WIRE_ID : unknownId(i))),
      90,
    );
    const served = results.filter((_, i) => kinds[i]);
    const missed = results.filter((_, i) => !kinds[i]);
    expect(served).toHaveLength(20);
    for (const r of served) await expectServed(r);
    expect(missed.filter((r) => r.status === 404)).toHaveLength(60);
    expect(missed.filter((r) => r.status === 429)).toHaveLength(10);
    await expectTooMany(await lookup(unknownId(999)), "Too many unknown sessions");
  });
});

describe("request limit", () => {
  it("a burst of 100 passes, then 429 with Retry-After 1, valid sessions included", async () => {
    for (let i = 0; i < 100; i++) expect((await lookup(WIRE_ID)).status).toBe(200);
    const wait = await expectTooMany(await lookup(WIRE_ID), "Too many requests");
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(2);
    await expectTooMany(await lookup(unknownId(0)), "Too many requests");
    // Another node has its own bucket.
    await expectServed(await lookup(WIRE_ID, NODE_B_KEY));
    // 30 a second refill.
    setSystemTime(after(1000));
    for (let i = 0; i < 30; i++) expect((await lookup(WIRE_ID)).status).toBe(200);
    await expectTooMany(await lookup(WIRE_ID), "Too many requests");
  });

  it("is checked before the read, and requests it refuses are not misses", async () => {
    expect((await missN(50)).every((s) => s === 404)).toBe(true);
    for (let i = 0; i < 50; i++) expect((await lookup(WIRE_ID)).status).toBe(200);
    const reads = lookups;
    for (let i = 0; i < 20; i++) await expectTooMany(await lookup(unknownId(100 + i)), "Too many requests");
    expect(lookups).toBe(reads);
    // 50 misses counted, so 10 more are allowed.
    setSystemTime(after(1000));
    expect((await missN(10)).every((s) => s === 404)).toBe(true);
    await expectTooMany(await lookup(unknownId(200)), "Too many unknown sessions");
  });

  it("holds under parallel requests", async () => {
    const results = await inParallel(
      Array.from({ length: 110 }, () => () => lookup(WIRE_ID)),
      100,
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(100);
    expect(results.filter((r) => r.status === 429)).toHaveLength(10);
  });
});
