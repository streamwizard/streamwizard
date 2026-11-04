import { beforeEach, describe, expect, it, mock } from "bun:test";
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
let claimedFields: Record<string, unknown> | null = null;
let lookups = 0;
/** What the pending-node lookup returns; the claim consumes the token only for "pending". */
let lookupRow: { id: string; name: string; status: string } | null;
mock.module("@repo/supabase/queries/ingest-nodes", () => ({
  ...realNodeQueries,
  claimIngestNodeByTokenHash: async () => {
    lookups++;
    return lookupRow;
  },
  consumeIngestClaimToken: async (_c: unknown, _hash: string, fields: Record<string, unknown>) => {
    claimedFields = fields;
    return lookupRow?.status === "pending" ? { id: NODE_ID, hostname: "ingest-1" } : null;
  },
  insertIngestNodeApiKey: async (_c: unknown, _id: string, fields: Record<string, unknown>) => {
    insertedKeyFields = fields;
  },
}));
mock.module("@/lib/tailscale", () => ({ mintTailscaleAuthKey: async () => null }));

const { claimIngestNode } = await import("./claim");
const { ingestNodeRoutes } = await import("@/modules/ingest-nodes/routes");
const app = new Hono().route("/", ingestNodeRoutes);

beforeEach(() => {
  lookupRow = { id: NODE_ID, name: "Ingest 1", status: "pending" };
});

describe("POST /api/ingest-nodes/claim", () => {
  it("hands out node-scoped credentials only, never database credentials", async () => {
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

  const claim = (body: string) =>
    app.request("/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

  it("stores only parsed hardware fields; a junk self-reported IP becomes null", async () => {
    const res = await claim(
      JSON.stringify({
        token: "claim-token",
        cpu_cores: 8,
        ram_total_mb: 16000,
        storage_total_mb: 500000,
        public_ip: "<html>error</html>",
        lan_ip: "192.168.1.20",
        tailscale_ip: null,
        status: "linked",
      }),
    );
    expect(res.status).toBe(200);
    expect(claimedFields).toMatchObject({ cpu_cores: 8, public_ip: null, lan_ip: "192.168.1.20", tailscale_ip: null });
    expect(claimedFields).not.toHaveProperty("status");
  });

  it("refuses malformed bodies with a 400 before any lookup", async () => {
    lookups = 0;
    for (const body of ["{not json", JSON.stringify({}), JSON.stringify({ token: 5 }), JSON.stringify({ token: "t", cpu_cores: "8" }), JSON.stringify({ token: "x".repeat(257) })]) {
      const res = await claim(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid body: token is required" });
    }
    expect(lookups).toBe(0);
  });

  it("maps each failed claim to its status and message", async () => {
    const cases = [
      [null, 404, "Invalid claim token"],
      [{ id: NODE_ID, name: "Ingest 1", status: "linked" }, 409, "This node has already been claimed"],
      [{ id: NODE_ID, name: "Ingest 1", status: "expired" }, 410, "Claim token has expired"],
    ] as const;
    for (const [row, status, error] of cases) {
      lookupRow = row;
      const res = await claim(JSON.stringify({ token: "claim-token" }));
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error });
    }
  });
});

describe("claimIngestNode", () => {
  it("says why a claim failed, without issuing an API key", async () => {
    insertedKeyFields = null;
    lookupRow = null;
    expect(await claimIngestNode({ token: "claim-token" })).toEqual({ ok: false, reason: "invalid_token" });
    lookupRow = { id: NODE_ID, name: "Ingest 1", status: "linked" };
    expect(await claimIngestNode({ token: "claim-token" })).toEqual({ ok: false, reason: "already_claimed" });
    lookupRow = { id: NODE_ID, name: "Ingest 1", status: "expired" };
    expect(await claimIngestNode({ token: "claim-token" })).toEqual({ ok: false, reason: "expired" });
    expect(insertedKeyFields).toBeNull();
  });
});
