import { describe, expect, it, mock } from "bun:test";
import { randomBytes } from "crypto";
import { Hono } from "hono";

const NODE_ID = "bbbbbbbb-0000-4000-8000-000000000001";
// Values that live only in rest-api's env. None may appear in a claim response.
const SECRETS = {
  OBS_S3_ACCESS_KEY: "storage-access-key-must-not-leave-rest-api",
  OBS_S3_SECRET_KEY: "storage-secret-key-must-not-leave-rest-api",
  SUPABASE_SECRET_KEY: "service-role-key-must-not-leave-rest-api",
};

mock.module("@repo/supabase", () => ({ supabase: {} }));
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
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/obs-nodes");
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  ...realNodeQueries,
  claimNodeByTokenHash: async () => {
    lookups++;
    return { id: NODE_ID, name: "GPU Box 1", status: "pending" };
  },
  consumeClaimToken: async () => ({ id: NODE_ID, hostname: "gpu-box-1" }),
  insertNodeApiKey: async () => {},
}));
mock.module("@/lib/tailscale", () => ({ mintTailscaleAuthKey: async () => null }));

const { claimObsNode } = await import("./claim");

describe("POST /api/obs-nodes/claim", () => {
  it("hands out node credentials and storage config, never the storage key", async () => {
    const app = new Hono().post("/claim", claimObsNode);
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
    const app = new Hono().post("/claim", claimObsNode);
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
});
