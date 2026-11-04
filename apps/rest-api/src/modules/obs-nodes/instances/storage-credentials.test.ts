import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";

const NODE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const NODE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const USER = "0e0e0000-0000-4000-8000-000000000001";
const INSTANCE = "1e1e0000-0000-4000-8000-000000000001";
const BUCKET = "streamwizard-obs";

const NODE_A_KEY = `storage-test-node-a-${randomBytes(8).toString("hex")}`;
const NODE_B_KEY = `storage-test-node-b-${randomBytes(8).toString("hex")}`;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const nodeByKeyHash = new Map([
  [hash(NODE_A_KEY), NODE_A],
  [hash(NODE_B_KEY), NODE_B],
]);

// instance id -> { node, owner }
const instances = new Map([[INSTANCE, { node: NODE_A, owner: USER }]]);
let stsCalls: { Policy: string; DurationSeconds: number }[];
let stsFails: boolean;

// Spread the real exports (the client is lazy, so nothing connects): the
// obs-nodes routes reach @repo/twitch-api, which imports more than the client.
const realSupabase = await import("@repo/supabase");
mock.module("@repo/supabase", () => ({ ...realSupabase, supabase: {} }));
mock.module("@/env", () => ({
  env: {
    OBS_S3_BUCKET: BUCKET,
    OBS_S3_ENDPOINT: "http://minio.test:9000",
    OBS_S3_REGION: "us-east-1",
    OBS_S3_ACCESS_KEY: "rest-api-key",
    OBS_S3_SECRET_KEY: "rest-api-secret",
  },
}));
// Spread the real exports: bun shares module mocks across test files.
const realObsQueries = await import("@repo/supabase/queries/obs-nodes");
mock.module("@repo/supabase/queries/obs-nodes", () => ({
  ...realObsQueries,
  lookupNodeByApiKeyHash: async (_c: unknown, keyHash: string) => nodeByKeyHash.get(keyHash) ?? null,
  getObsInstanceOwnerForNode: async (_c: unknown, id: string, nodeId: string) => {
    const row = instances.get(id);
    return row && row.node === nodeId ? row.owner : null;
  },
}));
const realSts = await import("@aws-sdk/client-sts");
mock.module("@aws-sdk/client-sts", () => ({
  ...realSts,
  STSClient: class {
    async send(cmd: { input: { Policy: string; DurationSeconds: number } }) {
      stsCalls.push(cmd.input);
      await Promise.resolve();
      if (stsFails) throw new Error("minio down");
      return {
        Credentials: {
          AccessKeyId: `temp-key-${stsCalls.length}`,
          SecretAccessKey: "temp-secret",
          SessionToken: "temp-session",
          Expiration: new Date(Date.now() + cmd.input.DurationSeconds * 1000),
        },
      };
    }
  },
}));

const { issueInstanceStorageCredentials } = await import("./storage-credentials");
const { issueSharedStorageCredentials } = await import("@/modules/obs-nodes/node/storage-credentials");
const { instanceStoragePolicy, resetStorageCredentialCache, sharedStoragePolicy } = await import(
  "@/modules/obs-nodes/storage-credentials"
);
const { obsNodeRoutes } = await import("@/modules/obs-nodes/routes");

// The real routes, so node auth and the response shaping are tested too.
const app = new Hono().route("/", obsNodeRoutes);
const post = (key: string, path: string) =>
  app.request(path, { method: "POST", headers: { Authorization: `Bearer ${key}` } });

beforeEach(() => {
  stsCalls = [];
  stsFails = false;
  resetStorageCredentialCache();
});

describe("issueInstanceStorageCredentials", () => {
  it("returns temporary credentials limited to the instance's own folders", async () => {
    const result = await issueInstanceStorageCredentials(NODE_A, INSTANCE);
    if (!result.ok) throw new Error("expected credentials");
    expect(result.creds).toMatchObject({ access_key_id: "temp-key-1", secret_access_key: "temp-secret", session_token: "temp-session" });
    expect(Date.parse(result.creds.expires_at)).toBeGreaterThan(Date.now());

    expect(stsCalls).toHaveLength(1);
    expect(stsCalls[0]!.DurationSeconds).toBe(3600);
    expect(JSON.parse(stsCalls[0]!.Policy)).toEqual(instanceStoragePolicy(BUCKET, USER, INSTANCE));
  });

  it("answers another node's instance and an unknown id the same way, without calling STS", async () => {
    expect(await issueInstanceStorageCredentials(NODE_B, INSTANCE)).toEqual({ ok: false, reason: "not_found" });
    expect(await issueInstanceStorageCredentials(NODE_A, "2e2e0000-0000-4000-8000-000000000009")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(stsCalls).toHaveLength(0);
  });

  it("reuses credentials, and concurrent requests share one STS call", async () => {
    const results = [
      ...(await Promise.all([issueInstanceStorageCredentials(NODE_A, INSTANCE), issueInstanceStorageCredentials(NODE_A, INSTANCE)])),
      await issueInstanceStorageCredentials(NODE_A, INSTANCE),
    ];
    const keys = results.map((r) => (r.ok ? r.creds.access_key_id : null));
    expect(new Set(keys)).toEqual(new Set(["temp-key-1"]));
    expect(stsCalls).toHaveLength(1);
  });

  it("is unavailable when MinIO refuses", async () => {
    stsFails = true;
    expect(await issueInstanceStorageCredentials(NODE_A, INSTANCE)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("issueSharedStorageCredentials", () => {
  it("returns read-only credentials for templates and plugins", async () => {
    expect((await issueSharedStorageCredentials(NODE_A)).ok).toBe(true);
    expect(JSON.parse(stsCalls[0]!.Policy)).toEqual(sharedStoragePolicy(BUCKET));
  });
});

describe("POST /instances/:id/storage-credentials", () => {
  it("returns the credentials with Cache-Control: no-store", async () => {
    const res = await post(NODE_A_KEY, `/instances/${INSTANCE}/storage-credentials`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ access_key_id: "temp-key-1" });
  });

  it("404s another node's instance, an unknown id and a junk id the same way", async () => {
    const other = await post(NODE_B_KEY, `/instances/${INSTANCE}/storage-credentials`);
    const unknown = await post(NODE_A_KEY, `/instances/2e2e0000-0000-4000-8000-000000000009/storage-credentials`);
    const junk = await post(NODE_A_KEY, `/instances/*/storage-credentials`);
    for (const res of [other, unknown, junk]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Instance not found" });
    }
    expect(stsCalls).toHaveLength(0);
  });

  it("answers 503 without details when MinIO refuses", async () => {
    stsFails = true;
    const res = await post(NODE_A_KEY, `/instances/${INSTANCE}/storage-credentials`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Could not issue storage credentials" });
  });

  it("needs a node API key", async () => {
    expect((await app.request(`/instances/${INSTANCE}/storage-credentials`, { method: "POST" })).status).toBe(401);
    expect(stsCalls).toHaveLength(0);
  });
});

describe("POST /storage-credentials", () => {
  it("returns read-only credentials with Cache-Control: no-store", async () => {
    const res = await post(NODE_A_KEY, "/storage-credentials");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(stsCalls[0]!.Policy)).toEqual(sharedStoragePolicy(BUCKET));
  });

  it("answers 503 without details when MinIO refuses", async () => {
    stsFails = true;
    const res = await post(NODE_A_KEY, "/storage-credentials");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Could not issue storage credentials" });
  });
});

describe("policies", () => {
  it("an instance policy names only that instance's config and media folders", () => {
    const policy = instanceStoragePolicy(BUCKET, USER, INSTANCE);
    const text = JSON.stringify(policy);
    expect(policy.Statement[0]).toEqual({
      Effect: "Allow",
      Action: ["s3:ListBucket"],
      Resource: [`arn:aws:s3:::${BUCKET}`],
      Condition: { StringLike: { "s3:prefix": [`obs-configs/${USER}/${INSTANCE}/*`, `obs-media/${USER}/${INSTANCE}/*`] } },
    });
    expect(policy.Statement[1]!.Resource).toEqual([
      `arn:aws:s3:::${BUCKET}/obs-configs/${USER}/${INSTANCE}/*`,
      `arn:aws:s3:::${BUCKET}/obs-media/${USER}/${INSTANCE}/*`,
    ]);
    expect(text).not.toContain("obs-templates");
    expect(text).not.toContain("plugins/");
  });

  it("the shared policy can only read", () => {
    const actions = sharedStoragePolicy(BUCKET).Statement.flatMap((s) => s.Action);
    expect(actions.sort()).toEqual(["s3:GetObject", "s3:ListBucket"]);
  });

  it("refuses ids that would widen the policy", () => {
    expect(() => instanceStoragePolicy(BUCKET, "*", INSTANCE)).toThrow();
    expect(() => instanceStoragePolicy(BUCKET, USER, "../x")).toThrow();
  });
});
