import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";

// Real AES-GCM with a throwaway key: the tests decrypt what the routes stored.
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");

type Row = {
  id: string;
  node_id: string;
  user_id: string;
  obs_ws_password_ciphertext: string | null;
  obs_ws_password_iv: string | null;
  obs_ws_password_tag: string | null;
  vnc_password_ciphertext: string | null;
  vnc_password_iv: string | null;
  vnc_password_tag: string | null;
  [key: string]: unknown;
};

const NODE_A_KEY = `secrets-test-node-a-${randomBytes(8).toString("hex")}`;
const NODE_B_KEY = `secrets-test-node-b-${randomBytes(8).toString("hex")}`;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const nodeByKeyHash = new Map([
  [hash(NODE_A_KEY), "node-a"],
  [hash(NODE_B_KEY), "node-b"],
]);

let rows: Map<string, Row>;
let inserted: Record<string, unknown> | null;
/** When set, the conditional VNC write "loses the race" to this password. */
let raceWinner: { ciphertext: string; iv: string; tag: string } | null;

const passwordFields = (r: Row) => ({
  obs_ws_password_ciphertext: r.obs_ws_password_ciphertext,
  obs_ws_password_iv: r.obs_ws_password_iv,
  obs_ws_password_tag: r.obs_ws_password_tag,
  vnc_password_ciphertext: r.vnc_password_ciphertext,
  vnc_password_iv: r.vnc_password_iv,
  vnc_password_tag: r.vnc_password_tag,
});

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/subscriptions", () => ({
  isActiveSubscriptionOfUser: async () => true,
  usersWithActiveSubscription: async () => new Set(),
}));
mock.module("../../../env", () => ({
  env: { NODE_TOKEN_PUBLIC_JWKS: undefined, NODE_CREATE_TOKEN_REQUIRED: false },
}));
// Spread the real exports: bun shares module mocks across test files.
const realQueries = await import("@repo/supabase/queries/obs-nodes");
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  ...realQueries,
  lookupNodeByApiKeyHash: async (_c: unknown, keyHash: string) => nodeByKeyHash.get(keyHash) ?? null,
  getObsInstancePasswordFieldsForNode: async (_c: unknown, id: string, nodeId: string) => {
    const r = rows.get(id);
    return r && r.node_id === nodeId ? passwordFields(r) : null;
  },
  setObsInstanceVncPasswordIfMissingForNode: async (
    _c: unknown,
    id: string,
    nodeId: string,
    enc: { ciphertext: string; iv: string; tag: string },
  ) => {
    const r = rows.get(id);
    if (!r || r.node_id !== nodeId) return false;
    if (raceWinner) {
      Object.assign(r, {
        vnc_password_ciphertext: raceWinner.ciphertext,
        vnc_password_iv: raceWinner.iv,
        vnc_password_tag: raceWinner.tag,
      });
      return false;
    }
    if (r.vnc_password_ciphertext !== null) return false;
    Object.assign(r, { vnc_password_ciphertext: enc.ciphertext, vnc_password_iv: enc.iv, vnc_password_tag: enc.tag });
    return true;
  },
  insertObsInstance: async (_c: unknown, fields: Record<string, unknown>) => {
    inserted = fields;
    return { id: "new-instance", node_id: fields.node_id, user_id: fields.user_id };
  },
  countActiveObsInstancesForNode: async () => 0,
  deleteObsInstanceForNode: async () => false,
  getObsInstanceByIdForNode: async () => null,
  listObsInstancesByNode: async () => [],
  listRunningObsInstancesByNode: async () => [],
  sumAllocatedVramForNode: async () => 0,
  updateObsInstanceByContainerIdForNode: async () => null,
  updateObsInstanceForNode: async () => null,
}));

let app: Hono;
let crypto: typeof import("@repo/supabase/crypto");
let schemas: typeof import("../../../schemas/obs-nodes");

beforeAll(async () => {
  // The real instance router, so auth and route order are tested too.
  const { default: obsNodeInstances } = await import("../../../routes/obs-node-instances");
  crypto = await import("@repo/supabase/crypto");
  schemas = await import("../../../schemas/obs-nodes");
  app = new Hono();
  app.route("/instances", obsNodeInstances);
});

const enc = (plaintext: string) => {
  const { ciphertext, iv, authTag } = crypto.encryptToken(plaintext);
  return { ciphertext, iv, tag: authTag };
};

function row(id: string, nodeId: string, opts: { obsWs?: string | null; vnc?: string | null } = {}): Row {
  const obsWs = opts.obsWs === undefined ? "obs-pass" : opts.obsWs;
  const vnc = opts.vnc === undefined ? "vnc-pass" : opts.vnc;
  const o = obsWs ? enc(obsWs) : null;
  const v = vnc ? enc(vnc) : null;
  return {
    id,
    node_id: nodeId,
    user_id: "user-1",
    obs_ws_password_ciphertext: o?.ciphertext ?? null,
    obs_ws_password_iv: o?.iv ?? null,
    obs_ws_password_tag: o?.tag ?? null,
    vnc_password_ciphertext: v?.ciphertext ?? null,
    vnc_password_iv: v?.iv ?? null,
    vnc_password_tag: v?.tag ?? null,
  };
}

const getSecrets = (id: string, key?: string) =>
  app.request(`/instances/${id}/secrets`, key ? { headers: { Authorization: `Bearer ${key}` } } : undefined);

beforeEach(() => {
  rows = new Map();
  inserted = null;
  raceWinner = null;
});

describe("GET /instances/:id/secrets", () => {
  it("returns the plaintext passwords of the node's own instance", async () => {
    rows.set("i1", row("i1", "node-a", { obsWs: "obs-secret", vnc: "vnc-secret" }));

    const res = await getSecrets("i1", NODE_A_KEY);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ obs_ws_password: "obs-secret", vnc_password: "vnc-secret" });
  });

  it("sets Cache-Control: no-store", async () => {
    rows.set("i1", row("i1", "node-a"));

    expect((await getSecrets("i1", NODE_A_KEY)).headers.get("Cache-Control")).toBe("no-store");
    expect((await getSecrets("missing", NODE_A_KEY)).headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers another node's instance exactly like a missing one (404)", async () => {
    rows.set("i1", row("i1", "node-a"));

    const other = await getSecrets("i1", NODE_B_KEY);
    const missing = await getSecrets("does-not-exist", NODE_B_KEY);

    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
  });

  it("rejects a missing or unknown NODE_API_KEY with 401", async () => {
    rows.set("i1", row("i1", "node-a"));

    expect((await getSecrets("i1")).status).toBe(401);
    expect((await getSecrets("i1", "not-a-real-node-key")).status).toBe(401);
  });

  it("returns null for an instance without an OBS WebSocket password", async () => {
    rows.set("i1", row("i1", "node-a", { obsWs: null }));

    const body = await (await getSecrets("i1", NODE_A_KEY)).json();

    expect(body.obs_ws_password).toBeNull();
    expect(body.vnc_password).toBe("vnc-pass");
  });

  it("generates, stores and returns a VNC password for an old row without one", async () => {
    rows.set("old", row("old", "node-a", { vnc: null }));

    const first = await (await getSecrets("old", NODE_A_KEY)).json();

    // 18 random bytes, base64: same shape the node used to generate.
    expect(Buffer.from(first.vnc_password, "base64")).toHaveLength(18);
    const saved = rows.get("old")!;
    expect(crypto.decryptToken(saved.vnc_password_ciphertext!, saved.vnc_password_iv!, saved.vnc_password_tag!)).toBe(
      first.vnc_password,
    );

    // Stable from then on.
    const second = await (await getSecrets("old", NODE_A_KEY)).json();
    expect(second.vnc_password).toBe(first.vnc_password);
  });

  it("returns the stored VNC password when a concurrent call saved one first", async () => {
    rows.set("old", row("old", "node-a", { vnc: null }));
    raceWinner = enc("winner-password");

    const body = await (await getSecrets("old", NODE_A_KEY)).json();

    expect(body.vnc_password).toBe("winner-password");
  });

  it("returns a 500 without the plaintext when decryption fails", async () => {
    const r = row("i1", "node-a");
    r.obs_ws_password_tag = Buffer.alloc(16).toString("base64"); // wrong auth tag
    rows.set("i1", r);

    const res = await getSecrets("i1", NODE_A_KEY);

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("obs-pass");
  });
});

describe("POST /instances", () => {
  const body = {
    user_id: "11111111-1111-4111-8111-111111111111",
    container_name: "obs-instance-x",
    resolution: "1920x1080",
    vram_allocated_mb: 4096,
    memory_mb: 4096,
    cpu_quota: 200000,
    shm_size: "1g",
    obs_ws_password: "plain-obs-password",
  };
  const post = (payload: unknown) =>
    app.request("/instances", {
      method: "POST",
      headers: { Authorization: `Bearer ${NODE_A_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  it("encrypts the OBS WebSocket password and generates the VNC password itself", async () => {
    const res = await post(body);

    expect(res.status).toBe(201);
    expect(inserted).not.toBeNull();
    const f = inserted as Record<string, string>;
    expect(f.node_id).toBe("node-a");
    expect(f.obs_ws_password).toBeUndefined();
    expect(crypto.decryptToken(f.obs_ws_password_ciphertext!, f.obs_ws_password_iv!, f.obs_ws_password_tag!)).toBe(
      "plain-obs-password",
    );
    const vnc = crypto.decryptToken(f.vnc_password_ciphertext!, f.vnc_password_iv!, f.vnc_password_tag!);
    expect(Buffer.from(vnc, "base64")).toHaveLength(18);
  });

  it("ignores ciphertext sent by the node", async () => {
    const planted = enc("someone-elses-secret");
    await post({
      ...body,
      obs_ws_password_ciphertext: planted.ciphertext,
      obs_ws_password_iv: planted.iv,
      obs_ws_password_tag: planted.tag,
      vnc_password_ciphertext: planted.ciphertext,
      vnc_password_iv: planted.iv,
      vnc_password_tag: planted.tag,
    });

    const f = inserted as Record<string, string>;
    expect(f.obs_ws_password_ciphertext).not.toBe(planted.ciphertext);
    expect(f.vnc_password_ciphertext).not.toBe(planted.ciphertext);
  });

  it("rejects a create without obs_ws_password", async () => {
    const { obs_ws_password: _omit, ...rest } = body;

    expect((await post(rest)).status).toBe(400);
    expect(inserted).toBeNull();
  });
});

describe("PATCH /instances schema", () => {
  it("drops every password column a node sends", () => {
    const parsed = schemas.updateInstanceSchema.parse({
      status: "running",
      obs_ws_password_ciphertext: "x",
      obs_ws_password_iv: "x",
      obs_ws_password_tag: "x",
      vnc_password_ciphertext: "x",
      vnc_password_iv: "x",
      vnc_password_tag: "x",
    });

    expect(parsed).toEqual({ status: "running" });
  });
});

describe("instance router", () => {
  const get = (path: string) => app.request(path, { headers: { Authorization: `Bearer ${NODE_A_KEY}` } });

  it("serves the list at the bare /instances path", async () => {
    const res = await get("/instances");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("matches static paths before /:id", async () => {
    expect(await (await get("/instances/vram")).json()).toEqual({ total_vram_mb: 0 });
    expect(await (await get("/instances/active-count")).json()).toEqual({ count: 0 });
  });

  it("requires the node API key on every instance route", async () => {
    for (const path of ["/instances", "/instances/vram", "/instances/i1", "/instances/i1/secrets"]) {
      expect((await app.request(path)).status).toBe(401);
    }
  });
});
