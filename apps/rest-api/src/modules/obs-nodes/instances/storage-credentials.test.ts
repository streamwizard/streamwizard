import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

const NODE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const NODE_B = "bbbbbbbb-0000-4000-8000-000000000002";
const USER = "0e0e0000-0000-4000-8000-000000000001";
const INSTANCE = "1e1e0000-0000-4000-8000-000000000001";
const BUCKET = "streamwizard-obs";

// instance id -> { node, owner }
const instances = new Map([[INSTANCE, { node: NODE_A, owner: USER }]]);
let stsCalls: { Policy: string; DurationSeconds: number }[];
let stsFails: boolean;

mock.module("@repo/supabase", () => ({ supabase: {} }));
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

const { getInstanceStorageCredentials } = await import("./storage-credentials");
const { getSharedStorageCredentials } = await import("@/modules/obs-nodes/node/storage-credentials");
const { instanceStoragePolicy, resetStorageCredentialCache, sharedStoragePolicy } = await import(
  "@/lib/obs-storage-credentials"
);

function app(nodeId: string) {
  const a = new Hono();
  a.use("*", async (c, next) => {
    c.set("nodeId" as never, nodeId as never);
    await next();
  });
  a.post("/instances/:id/storage-credentials", getInstanceStorageCredentials);
  a.post("/storage-credentials", getSharedStorageCredentials);
  return a;
}

const post = (nodeId: string, path: string) => app(nodeId).request(path, { method: "POST" });

beforeEach(() => {
  stsCalls = [];
  stsFails = false;
  resetStorageCredentialCache();
});

describe("POST /instances/:id/storage-credentials", () => {
  it("returns temporary credentials limited to the instance's own folders", async () => {
    const res = await post(NODE_A, `/instances/${INSTANCE}/storage-credentials`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as Record<string, string>;
    expect(body).toMatchObject({ access_key_id: "temp-key-1", secret_access_key: "temp-secret", session_token: "temp-session" });
    expect(Date.parse(body.expires_at!)).toBeGreaterThan(Date.now());

    expect(stsCalls).toHaveLength(1);
    expect(stsCalls[0]!.DurationSeconds).toBe(3600);
    expect(JSON.parse(stsCalls[0]!.Policy)).toEqual(instanceStoragePolicy(BUCKET, USER, INSTANCE));
  });

  it("404s another node's instance and an unknown id the same way, without calling STS", async () => {
    const other = await post(NODE_B, `/instances/${INSTANCE}/storage-credentials`);
    const unknown = await post(NODE_A, `/instances/2e2e0000-0000-4000-8000-000000000009/storage-credentials`);
    const junk = await post(NODE_A, `/instances/*/storage-credentials`);
    for (const res of [other, unknown, junk]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Instance not found" });
    }
    expect(stsCalls).toHaveLength(0);
  });

  it("reuses credentials, and concurrent requests share one STS call", async () => {
    const path = `/instances/${INSTANCE}/storage-credentials`;
    const [a, b] = await Promise.all([post(NODE_A, path), post(NODE_A, path)]);
    const c = await post(NODE_A, path);
    const keys = await Promise.all([a, b, c].map(async (r) => ((await r.json()) as { access_key_id: string }).access_key_id));
    expect(new Set(keys)).toEqual(new Set(["temp-key-1"]));
    expect(stsCalls).toHaveLength(1);
  });

  it("answers 503 without details when MinIO refuses", async () => {
    stsFails = true;
    const res = await post(NODE_A, `/instances/${INSTANCE}/storage-credentials`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Could not issue storage credentials" });
  });
});

describe("POST /storage-credentials", () => {
  it("returns read-only credentials for templates and plugins", async () => {
    const res = await post(NODE_A, "/storage-credentials");
    expect(res.status).toBe(200);
    expect(JSON.parse(stsCalls[0]!.Policy)).toEqual(sharedStoragePolicy(BUCKET));
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
