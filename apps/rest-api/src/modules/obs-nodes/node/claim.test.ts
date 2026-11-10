import { beforeEach, describe, expect, it, mock } from "bun:test";
import { randomBytes } from "crypto";
import { Hono } from "hono";

const NODE_ID = "bbbbbbbb-0000-4000-8000-000000000001";
// Values that live only in rest-api's env. None may appear in a claim response.
const SECRETS = {
  OBS_S3_ACCESS_KEY: "storage-access-key-must-not-leave-rest-api",
  OBS_S3_SECRET_KEY: "storage-secret-key-must-not-leave-rest-api",
  SUPABASE_SECRET_KEY: "service-role-key-must-not-leave-rest-api",
};

// Spread the real exports (the client is lazy, so nothing connects): the
// obs-nodes routes reach @repo/twitch-api, which imports more than the client.
const realSupabase = await import("@repo/supabase");
mock.module("@repo/supabase", () => ({ ...realSupabase, supabase: {} }));
mock.module("@/env", () => ({
  env: {
    ...SECRETS,
    SUPABASE_URL: "http://supabase.test",
    STREAMWIZARD_API_URL: "http://rest-api.test",
    OBS_S3_ENDPOINT: "http://storage.test",
    OBS_S3_BUCKET: "bucket",
    OBS_S3_REGION: "us-east-1",
  },
}));
// The command key is encrypted with the real crypto and a throwaway key.
process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
let lookups = 0;
/** What the pending-node lookup returns; the claim consumes the token only for "pending". */
let lookupRow: { id: string; name: string; status: string } | null;
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/obs-nodes/nodes");
mock.module("@repo/supabase/queries/obs-nodes/nodes", () => ({
  ...realNodeQueries,
  claimNodeByTokenHash: async () => {
    lookups++;
    return lookupRow;
  },
  consumeClaimToken: async () => (lookupRow?.status === "pending" ? { id: NODE_ID, hostname: "gpu-box-1" } : null),
}));
const realKeyQueries = await import("@repo/supabase/queries/obs-nodes/node-api-keys");
mock.module("@repo/supabase/queries/obs-nodes/node-api-keys", () => ({
  ...realKeyQueries,
  insertNodeApiKey: async () => {},
}));
mock.module("@/lib/tailscale", () => ({ mintTailscaleAuthKey: async () => null }));

const { claimObsNode } = await import("./claim");
const { obsNodeRoutes } = await import("@/modules/obs-nodes/routes");
const app = new Hono().route("/", obsNodeRoutes);

beforeEach(() => {
  lookupRow = { id: NODE_ID, name: "GPU Box 1", status: "pending" };
});

describe("POST /api/obs-nodes/claim", () => {
  it("hands out node credentials and storage config, never the storage key", async () => {
    const res = await app.request("/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "claim-token", gpu_bus_id: "PCI:0:1:0" }),
    });
    expect(res.status).toBe(200);
    const raw = await res.text();
    const body = JSON.parse(raw) as Record<string, unknown>;

    for (const value of Object.values(SECRETS)) expect(raw).not.toContain(value);
    expect(body).not.toHaveProperty("S3_ACCESS_KEY");
    expect(body).not.toHaveProperty("S3_SECRET_KEY");
    expect(body).toMatchObject({
      node_id: NODE_ID,
      hostname: "gpu-box-1",
      S3_ENDPOINT: "http://storage.test",
      S3_BUCKET: "bucket",
      S3_REGION: "us-east-1",
    });
    expect(typeof body.node_api_key).toBe("string");
  });

  it("refuses malformed bodies with a 400 before any lookup", async () => {
    lookups = 0;
    for (const body of [
      "{not json",
      JSON.stringify({ token: "t" }),
      JSON.stringify({ token: "t", gpu_bus_id: 1 }),
      JSON.stringify({ token: "t", gpu_bus_id: "PCI:0:1:0", cpu_cores: 1.5 }),
      JSON.stringify({ token: "t", gpu_bus_id: "PCI:0:1:0", gpu_model: "g".repeat(257) }),
    ]) {
      const res = await app.request("/claim", { method: "POST", headers: { "content-type": "application/json" }, body });
      expect(res.status).toBe(400);
    }
    expect(lookups).toBe(0);
  });

  it("maps each failed claim to its status and message", async () => {
    const cases = [
      [null, 404, "Invalid claim token"],
      [{ id: NODE_ID, name: "GPU Box 1", status: "linked" }, 409, "This node has already been claimed"],
      [{ id: NODE_ID, name: "GPU Box 1", status: "expired" }, 410, "Claim token has expired"],
    ] as const;
    for (const [row, status, error] of cases) {
      lookupRow = row;
      const res = await app.request("/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "claim-token", gpu_bus_id: "PCI:0:1:0" }),
      });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error });
    }
  });
});

describe("claimObsNode", () => {
  const input = { token: "claim-token", gpu_bus_id: "PCI:0:1:0" };

  it("says why a claim failed, without issuing anything", async () => {
    lookupRow = null;
    expect(await claimObsNode(input)).toEqual({ ok: false, reason: "invalid_token" });
    lookupRow = { id: NODE_ID, name: "GPU Box 1", status: "linked" };
    expect(await claimObsNode(input)).toEqual({ ok: false, reason: "already_claimed" });
    lookupRow = { id: NODE_ID, name: "GPU Box 1", status: "expired" };
    expect(await claimObsNode(input)).toEqual({ ok: false, reason: "expired" });
  });

  it("returns the node's credentials on success", async () => {
    const result = await claimObsNode(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.credentials).toMatchObject({ node_id: NODE_ID, hostname: "gpu-box-1" });
  });
});
