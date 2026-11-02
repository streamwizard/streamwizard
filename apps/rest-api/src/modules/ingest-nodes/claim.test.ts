import { describe, expect, it, mock } from "bun:test";
import { randomBytes } from "crypto";
import { Hono } from "hono";

const SECRET_SENTINEL = "service-role-key-must-not-leave-rest-api";
const NODE_ID = "aaaaaaaa-0000-4000-8000-000000000001";

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@/env", () => ({
  env: {
    SUPABASE_URL: "http://supabase.test",
    SUPABASE_SECRET_KEY: SECRET_SENTINEL,
    STREAMWIZARD_API_URL: "http://rest-api.test",
    WS_SERVER_URL: "ws://ws.test",
  },
}));
// The control secret is encrypted with the real crypto and a throwaway key.
process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
// Spread the real exports: bun shares module mocks across test files.
const realNodeQueries = await import("@repo/supabase/queries/ingest-nodes");
let insertedKeyFields: Record<string, unknown> | null = null;
mock.module("@repo/supabase/queries/ingest-nodes", () => ({
  ...realNodeQueries,
  claimIngestNodeByTokenHash: async () => ({ id: NODE_ID, name: "Ingest 1", status: "pending" }),
  consumeIngestClaimToken: async () => ({ id: NODE_ID, hostname: "ingest-1" }),
  insertIngestNodeApiKey: async (_c: unknown, _id: string, fields: Record<string, unknown>) => {
    insertedKeyFields = fields;
  },
}));
mock.module("@/lib/tailscale", () => ({ mintTailscaleAuthKey: async () => null }));

const { claimIngestNode } = await import("./claim");

describe("POST /api/ingest-nodes/claim", () => {
  it("hands out node-scoped credentials only, never database credentials", async () => {
    const app = new Hono().post("/claim", claimIngestNode);
    const res = await app.request("/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "claim-token" }),
    });
    expect(res.status).toBe(200);
    const raw = await res.text();
    const body = JSON.parse(raw) as Record<string, unknown>;

    expect(raw).not.toContain(SECRET_SENTINEL);
    expect(body).not.toHaveProperty("supabase_secret_key");
    expect(body).not.toHaveProperty("supabase_url");
    expect(body).not.toHaveProperty("ws_server_url");
    expect(body).toMatchObject({ node_id: NODE_ID, rest_api_url: "http://rest-api.test" });
    expect(typeof body.node_api_key).toBe("string");
    // Only the hash of the API key is stored.
    expect(Object.keys(insertedKeyFields ?? {})).toEqual(["key_hash"]);
  });
});
