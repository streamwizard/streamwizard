import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, setSystemTime, spyOn } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";

// POST /api/live/sessions, /renew and /end, against in-memory stand-ins for the
// live_sessions table, the stream keys and the plans. The real crypto runs,
// so the stored row and the ingest lookup are checked end to end.

process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");

const ENDPOINTS = [{ host: "192.168.1.20", port: 7000 }];
const NODE_KEY = `live-test-node-${randomBytes(8).toString("hex")}`;
const NODE_ID = "aaaaaaaa-0000-4000-8000-0000000000f1";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Bearer `user-<n>` signs in as a user with this id. */
const userId = (n: number) => `0e0e0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER_A = userId(1);
const USER_B = userId(2);

type Key = { id: string; user_id: string; stream_key: string; is_active: boolean };
type Session = {
  wire_id: string;
  user_id: string;
  key_id: string;
  stream_key_at_create: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
  protocol_version: number;
  created_ip: string | null;
  created_at: string;
  expires_at: string;
  ended_at: string | null;
  revoked_at: string | null;
};
let keys: Map<string, Key>;
let sessions: Map<string, Session>;
let planHolders: Set<string>;
let ownerLookups: number;
let createError: string | null;
let takenWireIds: number;
let renewError: string | null;
let renewCalls: number;
/** The lifetime the last create_live_session call got. */
let createLifetimes: number[];
/** Runs right after a successful key lookup, e.g. to rotate the key before the insert. */
let afterOwnerLookup: (() => void) | null;

const keyByValue = (value: string) => [...keys.values()].find((k) => k.stream_key === value);

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@/env", () => ({
  env: { NODE_TOKEN_PUBLIC_JWKS: undefined, WS_SERVER_URL: undefined, LIVE_INGEST_ENDPOINTS: ENDPOINTS, LIVE_LATENCY_MS: 2000, LIVE_SESSION_LIFETIME_S: 86400 },
}));
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/ingest/nodes");
mock.module("@repo/supabase/queries/ingest/nodes", () => ({
  ...realNodeQueries,
  lookupIngestNodeByApiKeyHash: async (_c: unknown, keyHash: string) => (keyHash === hash(NODE_KEY) ? NODE_ID : null),
}));
const realIngest = await import("@repo/supabase/queries/ingest/ingest");
mock.module("@repo/supabase/queries/ingest/ingest", () => ({
  ...realIngest,
  getStreamKeyOwner: async (_c: unknown, value: string, product: string) => {
    ownerLookups++;
    const key = keyByValue(value);
    if (!key || !key.is_active || product !== "cloud_obs" || !planHolders.has(key.user_id)) return null;
    afterOwnerLookup?.();
    return { user_id: key.user_id, key_id: key.id, label: "Phone" };
  },
  getOutputKeysForKey: async () => ({ data: [{ output_key: "out-1" }], error: null }),
}));
const realSubscriptions = await import("@repo/supabase/queries/subscriptions/subscriptions");
mock.module("@repo/supabase/queries/subscriptions/subscriptions", () => ({
  ...realSubscriptions,
  getUserActiveSubscriptionId: async (_c: unknown, user: string) => (planHolders.has(user) ? `sub-${user}` : null),
}));
const realLive = await import("@repo/supabase/queries/ingest/live-sessions");
mock.module("@repo/supabase/queries/ingest/live-sessions", () => ({
  ...realLive,
  // What create_live_session does: refuse a changed key, revoke the key's
  // open sessions, insert.
  createLiveSession: async (
    _c: unknown,
    row: Omit<Session, "created_at" | "expires_at" | "ended_at" | "revoked_at" | "stream_key_at_create"> & { stream_key: string; lifetime_s: number },
  ) => {
    createLifetimes.push(row.lifetime_s);
    if (createError) return { data: null, error: { code: createError } };
    if (takenWireIds > 0) {
      takenWireIds--;
      return { data: null, error: { code: "23505" } };
    }
    const key = keys.get(row.key_id);
    if (!key || key.user_id !== row.user_id || key.stream_key !== row.stream_key || !key.is_active) {
      return { data: null, error: null };
    }
    for (const s of sessions.values()) {
      if (s.key_id === row.key_id && !s.revoked_at && !s.ended_at) s.revoked_at = new Date().toISOString();
    }
    const { stream_key, lifetime_s, ...rest } = row;
    const created_at = new Date().toISOString().replace("Z", "+00:00");
    const expires_at = new Date(Date.now() + lifetime_s * 1000).toISOString().replace("Z", "+00:00");
    sessions.set(row.wire_id, { ...rest, stream_key_at_create: stream_key, created_at, expires_at, ended_at: null, revoked_at: null });
    return { data: { wire_id: row.wire_id, expires_at }, error: null };
  },
  // What renew_live_session does: the user's own open, unexpired session
  // with an active key gets now + lifetime.
  renewLiveSessionForUser: async (_c: unknown, wireId: string, user: string, lifetimeS: number) => {
    renewCalls++;
    if (renewError) return { data: null, error: { code: renewError } };
    const s = sessions.get(wireId);
    const key = s && keys.get(s.key_id);
    if (!s || !key || s.user_id !== user || key.user_id !== user || s.ended_at || s.revoked_at || !key.is_active || Date.parse(s.expires_at) <= Date.now()) {
      return { data: null, error: null };
    }
    s.expires_at = new Date(Date.now() + lifetimeS * 1000).toISOString().replace("Z", "+00:00");
    return { data: { wire_id: s.wire_id, expires_at: s.expires_at }, error: null };
  },
  endLiveSessionForUser: async (_c: unknown, wireId: string, user: string) => {
    const s = sessions.get(wireId);
    if (!s || s.user_id !== user) return null;
    if (s.ended_at) return { endedNow: false };
    s.ended_at = new Date().toISOString();
    return { endedNow: true };
  },
  getLiveSessionByWireId: async (_c: unknown, wireId: string) => {
    const s = sessions.get(wireId);
    if (!s) return null;
    return { ...s, key_is_active: keys.get(s.key_id)?.is_active ?? false };
  },
}));

let app: Hono;
let resetLiveSessionLimits: () => void;
let resetLiveSessionMisses: () => void;
let logged: string[] = [];
const consoleSpies: ReturnType<typeof spyOn>[] = [];

beforeAll(async () => {
  const { liveSessionRoutes } = await import("@/modules/live-sessions/routes");
  const { ingestNodeRoutes } = await import("@/modules/ingest-nodes/routes");
  ({ resetLiveSessionLimits } = await import("./sessions"));
  ({ resetLiveSessionMisses } = await import("@/modules/ingest-nodes/live-sessions"));
  app = new Hono();
  // Stands in for supabaseMiddleware(): a request client whose getUser()
  // knows the `user-<n>` tokens.
  app.use("/api/live/*", async (c, next) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    const n = token?.match(/^user-(\d+)$/)?.[1];
    c.set("supabase", {
      auth: {
        getUser: async () =>
          n
            ? { data: { user: { id: userId(Number(n)) } }, error: null }
            : { data: { user: null }, error: { status: 401, code: "bad_jwt" } },
      },
    } as never);
    await next();
  });
  app.route("/api/live", liveSessionRoutes);
  app.route("/api/ingest-nodes", ingestNodeRoutes);

  // Everything the code under test writes to the console, for the
  // "no secret in the logs" checks.
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    consoleSpies.push(
      spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : JSON.stringify(a) ?? String(a))).join(" "));
      }),
    );
  }
});

afterAll(() => {
  for (const spy of consoleSpies) spy.mockRestore();
});

beforeEach(async () => {
  keys = new Map([
    ["4e440000-0000-4000-8000-0000000000a1", { id: "4e440000-0000-4000-8000-0000000000a1", user_id: USER_A, stream_key: "sk-a-Zq81", is_active: true }],
    ["4e440000-0000-4000-8000-0000000000a2", { id: "4e440000-0000-4000-8000-0000000000a2", user_id: USER_A, stream_key: "sk-a2-Zq81", is_active: true }],
    ["4e440000-0000-4000-8000-0000000000b1", { id: "4e440000-0000-4000-8000-0000000000b1", user_id: USER_B, stream_key: "sk-b-Zq81", is_active: true }],
    ["4e440000-0000-4000-8000-0000000000a9", { id: "4e440000-0000-4000-8000-0000000000a9", user_id: USER_A, stream_key: "sk-off-Zq81", is_active: false }],
  ]);
  sessions = new Map();
  planHolders = new Set([USER_A, USER_B]);
  ownerLookups = 0;
  createError = null;
  takenWireIds = 0;
  renewError = null;
  renewCalls = 0;
  createLifetimes = [];
  afterOwnerLookup = null;
  logged = [];
  resetLiveSessionLimits();
  resetLiveSessionMisses();
  const { env } = await import("@/env");
  (env as Record<string, unknown>).LIVE_INGEST_ENDPOINTS = ENDPOINTS;
  (env as Record<string, unknown>).LIVE_LATENCY_MS = 2000;
  (env as Record<string, unknown>).LIVE_SESSION_LIFETIME_S = 86400;
});

afterEach(() => {
  setSystemTime();
});

let ipCounter = 0;
/** A fresh client IP per call unless one is given, so per-IP limits stay out of the way. */
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

function create(body: unknown, opts: { user?: number | null; ip?: string } = {}) {
  const user = opts.user === undefined ? 1 : opts.user;
  return app.request("/api/live/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": opts.ip ?? nextIp(),
      ...(user !== null ? { Authorization: `Bearer user-${user}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const end = (sessionId: string, user: number | null = 1) =>
  app.request(`/api/live/sessions/${sessionId}/end`, {
    method: "POST",
    headers: user !== null ? { Authorization: `Bearer user-${user}` } : {},
  });
const renew = (sessionId: string, user: number | null = 1) =>
  app.request(`/api/live/sessions/${sessionId}/renew`, {
    method: "POST",
    headers: user !== null ? { Authorization: `Bearer user-${user}` } : {},
  });
const lookup = (sessionId: string) =>
  app.request(`/api/ingest-nodes/live-sessions/${sessionId}`, { headers: { Authorization: `Bearer ${NODE_KEY}` } });

type Created = {
  session_id: string;
  session_secret: string;
  protocol_version: number;
  ingest: unknown;
  expires_at: string;
  expires_in: number;
  latency_ms: number;
};
const createOk = async (streamKey = "sk-a-Zq81", user = 1) => {
  const res = await create({ stream_key: streamKey }, { user });
  expect(res.status).toBe(201);
  return (await res.json()) as Created;
};

describe("POST /api/live/sessions", () => {
  it("opens a session: wire id, 32-byte secret, protocol version, ingest addresses, expiry", async () => {
    setSystemTime(new Date("2026-11-20T11:00:00.000Z"));
    const res = await create({ stream_key: "sk-a-Zq81" }, { ip: "203.0.113.7" });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as Created;
    expect(Object.keys(body).sort()).toEqual(["expires_at", "expires_in", "ingest", "latency_ms", "protocol_version", "session_id", "session_secret"]);
    expect(body.session_id).toMatch(/^[0-9a-f]{16}$/);
    expect(body.session_id).not.toBe("0000000000000000");
    expect(body.session_secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(body.session_secret, "base64url")).toHaveLength(32);
    expect(body.protocol_version).toBe(1);
    expect(body.ingest).toEqual(ENDPOINTS);
    expect(body.expires_at).toBe("2026-11-21T11:00:00.000Z");
    expect(body.expires_in).toBe(86400);
    expect(body.latency_ms).toBe(2000);
    expect(createLifetimes).toEqual([86400]);

    const row = sessions.get(body.session_id)!;
    expect(row).toMatchObject({ user_id: USER_A, key_id: "4e440000-0000-4000-8000-0000000000a1", protocol_version: 1, created_ip: "203.0.113.7" });
    // Stored encrypted, never as plaintext.
    expect(JSON.stringify(row)).not.toContain(body.session_secret);
    const { decryptToken } = await import("@repo/supabase/crypto");
    expect(decryptToken(row.secret_ciphertext, row.secret_iv, row.secret_tag)).toBe(body.session_secret);
  });

  it("passes LIVE_SESSION_LIFETIME_S to the database and states expires_in", async () => {
    setSystemTime(new Date("2026-11-20T11:00:00.000Z"));
    const { env } = await import("@/env");
    (env as Record<string, unknown>).LIVE_SESSION_LIFETIME_S = 600;
    const body = await createOk();
    expect(createLifetimes).toEqual([600]);
    expect(body.expires_at).toBe("2026-11-20T11:10:00.000Z");
    expect(body.expires_in).toBe(600);
  });

  it("gives every session its own id and secret", async () => {
    const first = await createOk("sk-a-Zq81");
    const second = await createOk("sk-a2-Zq81");
    expect(first.session_id).not.toBe(second.session_id);
    expect(first.session_secret).not.toBe(second.session_secret);
  });

  it("the ingest node gets the same secret and latency budget back", async () => {
    setSystemTime(new Date("2026-11-20T11:00:00.000Z"));
    const created = await createOk();
    const res = await lookup(created.session_id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      session_id: created.session_id,
      session_secret: created.session_secret,
      protocol_version: 1,
      user_id: USER_A,
      stream_key_id: "4e440000-0000-4000-8000-0000000000a1",
      output_keys: ["out-1"],
      created_at: "2026-11-20T11:00:00.000Z",
      expires_at: created.expires_at,
      latency_ms: created.latency_ms,
    });
  });

  it("both ends get LIVE_LATENCY_MS as the session's latency_ms", async () => {
    const { env } = await import("@/env");
    (env as Record<string, unknown>).LIVE_LATENCY_MS = 4000;
    const created = await createOk();
    expect(created.latency_ms).toBe(4000);
    const looked = (await (await lookup(created.session_id)).json()) as { latency_ms: number };
    expect(looked.latency_ms).toBe(4000);
  });

  it("revokes the key's previous session, not the user's other keys' sessions", async () => {
    const other = await createOk("sk-a2-Zq81");
    const first = await createOk("sk-a-Zq81");
    const second = await createOk("sk-a-Zq81");
    expect(sessions.get(first.session_id)!.revoked_at).not.toBeNull();
    expect((await lookup(first.session_id)).status).toBe(404);
    expect((await lookup(second.session_id)).status).toBe(200);
    expect((await lookup(other.session_id)).status).toBe(200);
  });

  it("needs a signed-in user", async () => {
    expect((await create({ stream_key: "sk-a-Zq81" }, { user: null })).status).toBe(401);
    const res = await app.request("/api/live/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer not-a-token" },
      body: JSON.stringify({ stream_key: "sk-a-Zq81" }),
    });
    expect(res.status).toBe(401);
    expect(ownerLookups).toBe(0);
  });

  it("refuses a bad body before looking anything up", async () => {
    expect((await create({})).status).toBe(400);
    expect((await create({ stream_key: "" })).status).toBe(400);
    expect((await create({ stream_key: "x".repeat(257) })).status).toBe(400);
    expect((await create({ stream_key: 42 })).status).toBe(400);
    expect((await create("{not json")).status).toBe(400);
    expect(ownerLookups).toBe(0);
  });

  it("gives one answer for an unknown, inactive, plan-less or someone else's key", async () => {
    const answers = [];
    for (const [streamKey, user] of [
      ["nope", 1],
      ["sk-off-Zq81", 1],
      ["sk-b-Zq81", 1], // user B's key, user A asking
    ] as const) {
      const res = await create({ stream_key: streamKey }, { user });
      answers.push([res.status, await res.json()]);
    }
    planHolders.delete(USER_B);
    const res = await create({ stream_key: "sk-b-Zq81" }, { user: 2 });
    answers.push([res.status, await res.json()]);
    for (const answer of answers) expect(answer).toEqual([403, { error: "Invalid stream key" }]);
    expect(sessions.size).toBe(0);
  });

  it("403 when the key is rotated between the check and the insert", async () => {
    afterOwnerLookup = () => {
      keys.get("4e440000-0000-4000-8000-0000000000a1")!.stream_key = "rotated";
    };
    const res = await create({ stream_key: "sk-a-Zq81" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid stream key" });
    expect(sessions.size).toBe(0);
  });

  it("503 when no ingest endpoint is configured", async () => {
    const { env } = await import("@/env");
    (env as Record<string, unknown>).LIVE_INGEST_ENDPOINTS = [];
    const res = await create({ stream_key: "sk-a-Zq81" });
    expect(res.status).toBe(503);
    expect(ownerLookups).toBe(0);
    expect(sessions.size).toBe(0);
  });

  it("retries a taken wire id", async () => {
    takenWireIds = 2;
    await createOk();
    expect(sessions.size).toBe(1);
  });

  it("500 with a generic message when the database fails", async () => {
    createError = "XX000";
    const res = await create({ stream_key: "sk-a-Zq81" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not start the session" });
  });
});

describe("rate limits", () => {
  const expect429 = async (res: Response) => {
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    return retryAfter;
  };

  // Spaced 7 s apart, so the per-minute create limit stays out of the way and
  // only the 10-minute invalid-key limit counts.
  const T0 = new Date("2026-11-20T12:00:00.000Z").getTime();
  let clock = T0;
  const tick = () => {
    clock += 7000;
    setSystemTime(new Date(clock));
  };
  const spacedCreate = (body: unknown, opts?: { user?: number | null; ip?: string }) => {
    tick();
    return create(body, opts);
  };

  it("a user who keeps trying invalid keys is blocked, also for valid ones, until the window ends", async () => {
    clock = T0 - 7000;
    for (let i = 0; i < 10; i++) expect((await spacedCreate({ stream_key: `guess-${i}` })).status).toBe(403);
    // First guess at T0, this attempt 70 s later.
    const retryAfter = await expect429(await spacedCreate({ stream_key: "sk-a-Zq81" }));
    expect(retryAfter).toBe(600 - 70);
    // Another user is not affected.
    expect((await create({ stream_key: "sk-b-Zq81" }, { user: 2 })).status).toBe(201);
    setSystemTime(new Date(T0 + 10 * 60 * 1000 + 1000));
    expect((await create({ stream_key: "sk-a-Zq81" })).status).toBe(201);
  });

  it("invalid keys from one IP are limited across users", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await create({ stream_key: `guess-${i}` }, { user: 100 + i, ip: "203.0.113.50" })).status).toBe(403);
    }
    await expect429(await create({ stream_key: "sk-b-Zq81" }, { user: 2, ip: "203.0.113.50" }));
    expect((await create({ stream_key: "sk-b-Zq81" }, { user: 2, ip: "203.0.113.51" })).status).toBe(201);
  });

  it("valid keys give their invalid-key attempt back", async () => {
    clock = T0 - 7000;
    for (let i = 0; i < 9; i++) expect((await spacedCreate({ stream_key: `guess-${i}` })).status).toBe(403);
    expect((await spacedCreate({ stream_key: "sk-a-Zq81" })).status).toBe(201);
    expect((await spacedCreate({ stream_key: "guess-last" })).status).toBe(403);
    await expect429(await spacedCreate({ stream_key: "guess-over" }));
  });

  it("parallel guesses can't slip past the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => create({ stream_key: `guess-${i}` }, { user: 200 + i, ip: "203.0.113.70" })),
    );
    expect(results.filter((r) => r.status === 403)).toHaveLength(20);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(ownerLookups).toBe(20);
  });

  it("limits creates per stream key", async () => {
    for (let i = 0; i < 5; i++) await createOk("sk-a-Zq81");
    await expect429(await create({ stream_key: "sk-a-Zq81" }));
    await createOk("sk-a2-Zq81");
  });

  it("limits creates per user, and lets them through again a minute later", async () => {
    setSystemTime(new Date("2026-11-20T13:00:00.000Z"));
    for (let i = 0; i < 5; i++) await createOk("sk-a-Zq81");
    for (let i = 0; i < 5; i++) await createOk("sk-a2-Zq81");
    const retryAfter = await expect429(await create({ stream_key: "sk-a2-Zq81" }));
    expect(retryAfter).toBe(60);
    expect((await create({ stream_key: "sk-b-Zq81" }, { user: 2 })).status).toBe(201);
    setSystemTime(new Date("2026-11-20T13:01:01.000Z"));
    await createOk("sk-a2-Zq81");
  });

  it("limits creates per IP across users", async () => {
    for (let i = 0; i < 30; i++) {
      const id = `4e440000-0000-4000-8000-${String(500 + i).padStart(12, "0")}`;
      keys.set(id, { id, user_id: userId(500 + i), stream_key: `key-${500 + i}`, is_active: true });
      planHolders.add(userId(500 + i));
      expect((await create({ stream_key: `key-${500 + i}` }, { user: 500 + i, ip: "203.0.113.60" })).status).toBe(201);
    }
    await expect429(await create({ stream_key: "sk-a-Zq81" }, { ip: "203.0.113.60" }));
    expect((await create({ stream_key: "sk-a-Zq81" }, { ip: "203.0.113.61" })).status).toBe(201);
  });
});

describe("POST /api/live/sessions/:session_id/renew", () => {
  type Renewed = { session_id: string; expires_at: string; expires_in: number };
  const T0 = new Date("2026-11-20T11:00:00.000Z").getTime();

  it("moves the expiry to now plus the lifetime; the ingest node sees it, with the same secret", async () => {
    setSystemTime(new Date(T0));
    const created = await createOk();
    expect(created.expires_at).toBe("2026-11-21T11:00:00.000Z");

    setSystemTime(new Date(T0 + 20 * 60 * 60 * 1000));
    const res = await renew(created.session_id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as Renewed;
    expect(body).toEqual({ session_id: created.session_id, expires_at: "2026-11-22T07:00:00.000Z", expires_in: 86400 });

    // Past the original 24 hours the node still serves it.
    setSystemTime(new Date(T0 + 30 * 60 * 60 * 1000));
    const looked = await lookup(created.session_id);
    expect(looked.status).toBe(200);
    const node = (await looked.json()) as { session_secret: string; expires_at: string };
    expect(node.session_secret).toBe(created.session_secret);
    expect(node.expires_at).toBe(body.expires_at);
  });

  it("slides: never more than one lifetime ahead, also after many renewals", async () => {
    setSystemTime(new Date(T0));
    const { session_id } = await createOk();
    for (let i = 0; i < 3; i++) expect((await renew(session_id)).status).toBe(200);
    const body = (await (await renew(session_id)).json()) as Renewed;
    expect(body.expires_at).toBe("2026-11-21T11:00:00.000Z");
    expect(body.expires_in).toBe(86400);
  });

  it("uses LIVE_SESSION_LIFETIME_S", async () => {
    setSystemTime(new Date(T0));
    const { env } = await import("@/env");
    (env as Record<string, unknown>).LIVE_SESSION_LIFETIME_S = 3600;
    const { session_id } = await createOk();
    setSystemTime(new Date(T0 + 30 * 60 * 1000));
    const body = (await (await renew(session_id)).json()) as Renewed;
    expect(body).toEqual({ session_id, expires_at: "2026-11-20T12:30:00.000Z", expires_in: 3600 });
  });

  it("one 404 for unknown, malformed, someone else's, ended, revoked, expired, key off and plan-less", async () => {
    setSystemTime(new Date(T0));
    const own = await createOk("sk-a-Zq81");
    const ended = await createOk("sk-a2-Zq81");
    await end(ended.session_id);
    const revoked = await createOk("sk-b-Zq81", 2);
    const current = await createOk("sk-b-Zq81", 2); // revokes the previous one
    const keyOff = await createOk("sk-a2-Zq81"); // a new session for the ended one's key
    keys.get("4e440000-0000-4000-8000-0000000000a2")!.is_active = false;
    const answers: [number, unknown][] = [];
    const record = async (res: Response) => answers.push([res.status, await res.json()]);

    await record(await renew("00000000000000ff"));
    await record(await renew("not-a-wire-id"));
    await record(await renew("0000000000000000"));
    await record(await renew("9F3C2A71E04B5D18"));
    await record(await renew(own.session_id, 2)); // user B asking for A's session
    await record(await renew(ended.session_id));
    await record(await renew(revoked.session_id, 2));
    await record(await renew(keyOff.session_id));
    planHolders.delete(USER_B);
    await record(await renew(current.session_id, 2));
    planHolders.add(USER_B);
    setSystemTime(new Date(T0 + 24 * 60 * 60 * 1000));
    await record(await renew(own.session_id));

    expect(answers).toHaveLength(10);
    for (const answer of answers) expect(answer).toEqual([404, { error: "Session not found" }]);
    // Nothing moved.
    expect(sessions.get(own.session_id)!.expires_at).toBe("2026-11-21T11:00:00.000+00:00");
    expect(sessions.get(current.session_id)!.expires_at).toBe("2026-11-21T11:00:00.000+00:00");
  });

  it("needs a signed-in user", async () => {
    const { session_id, expires_at } = await createOk();
    expect((await renew(session_id, null)).status).toBe(401);
    const res = await app.request(`/api/live/sessions/${session_id}/renew`, { method: "POST", headers: { Authorization: "Bearer not-a-token" } });
    expect(res.status).toBe(401);
    expect(renewCalls).toBe(0);
    expect(new Date(sessions.get(session_id)!.expires_at).toISOString()).toBe(expires_at);
  });

  it("limits renewals to 10 a minute per user", async () => {
    setSystemTime(new Date(T0));
    const { session_id } = await createOk();
    for (let i = 0; i < 10; i++) expect((await renew(session_id)).status).toBe(200);
    setSystemTime(new Date(T0 + 15 * 1000));
    const res = await renew(session_id);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("45");
    expect(await res.json()).toEqual({ error: "Too many attempts. Try again later." });
    expect(renewCalls).toBe(10);
    // Misses count too.
    expect((await renew("00000000000000ff")).status).toBe(429);
    // Another user is not affected.
    const other = await createOk("sk-b-Zq81", 2);
    expect((await renew(other.session_id, 2)).status).toBe(200);
    setSystemTime(new Date(T0 + 61 * 1000));
    expect((await renew(session_id)).status).toBe(200);
  });

  it("500 with a generic message when the database fails", async () => {
    const { session_id } = await createOk();
    renewError = "XX000";
    const res = await renew(session_id);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not renew the session" });
  });
});

describe("POST /api/live/sessions/:session_id/end", () => {
  it("ends the owner's session; the ingest node stops getting it", async () => {
    const { session_id } = await createOk();
    const res = await end(session_id);
    expect(res.status).toBe(204);
    expect(sessions.get(session_id)!.ended_at).not.toBeNull();
    expect((await lookup(session_id)).status).toBe(404);
  });

  it("is idempotent, also for a revoked session", async () => {
    const first = await createOk();
    await createOk(); // revokes the first
    expect((await end(first.session_id)).status).toBe(204);
    expect((await end(first.session_id)).status).toBe(204);
  });

  it("another user's session gets the same 404 as a missing or malformed one", async () => {
    const { session_id } = await createOk();
    for (const res of [await end(session_id, 2), await end("00000000000000ff"), await end("not-a-wire-id"), await end("0000000000000000")]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Session not found" });
    }
    expect(sessions.get(session_id)!.ended_at).toBeNull();
  });

  it("needs a signed-in user", async () => {
    const { session_id } = await createOk();
    expect((await end(session_id, null)).status).toBe(401);
    expect(sessions.get(session_id)!.ended_at).toBeNull();
  });
});

describe("secrets stay out of logs and errors", () => {
  it("no session secret or stream key in console output or error responses", async () => {
    const streamKeys = [...keys.values()].map((k) => k.stream_key);
    const created = await createOk("sk-a-Zq81");
    await lookup(created.session_id);

    // Failure paths that log: a database error on create, an undecryptable
    // secret on lookup, a rejected sign-in.
    createError = "XX000";
    const failed = await create({ stream_key: "sk-a2-Zq81" });
    createError = null;
    const second = await createOk("sk-a2-Zq81");
    sessions.get(second.session_id)!.secret_tag = Buffer.alloc(16).toString("base64");
    const broken = await lookup(second.session_id);
    expect(broken.status).toBe(500);
    await create({ stream_key: "sk-a-Zq81" }, { user: null });
    const renewed = await renew(created.session_id);
    renewError = "XX000";
    const failedRenew = await renew(created.session_id);
    renewError = null;

    const output =
      logged.join("\n") + (await failed.text()) + (await broken.text()) + (await renewed.text()) + (await failedRenew.text());
    expect(logged.length).toBeGreaterThan(0);
    for (const secret of [created.session_secret, second.session_secret, ...streamKeys]) {
      expect(output).not.toContain(secret);
    }
  });
});
