import { beforeAll, expect, mock, test } from "bun:test";
import { calculateJwkThumbprint, createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, type JSONWebKeySet } from "jose";

// The client picks both arguments of mintNodeTokenAction, so these pin what
// the server refuses: other people's instances, admin scopes and callers
// whose Cloud OBS plan is gone.

let signedIn: { id: string } | null = { id: "user-1" };
let access = { canAccess: true, canInteract: true };
const MINE = "4a1f0c2e-8b7d-4c3a-9e5f-1d2c3b4a5e6f";
const THEIRS = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const instances: Record<string, { userId: string; nodeId: string }> = {
  [MINE]: { userId: "user-1", nodeId: "node-a" },
  [THEIRS]: { userId: "user-2", nodeId: "node-b" },
};

// Spread the real exports: bun shares module mocks across test files.
const realAuth = await import("@/lib/auth");
mock.module("@/lib/auth", () => ({
  ...realAuth,
  tryAuthContext: async () => (signedIn ? { user: signedIn, supabase: {} } : null),
}));
// Spread the real exports: bun shares module mocks across test files, so a
// partial mock here breaks later files that import other names from it.
const realSubscriptions = await import("@repo/supabase/queries/subscriptions/subscriptions");
mock.module("@repo/supabase/queries/subscriptions/subscriptions", () => ({
  ...realSubscriptions,
  getProductAccess: async () => ({ ...access, status: "active", plan: null }),
}));
const realAdmin = await import("@repo/supabase/next/admin");
mock.module("@repo/supabase/next/admin", () => ({ ...realAdmin, createAdminClient: () => ({}) }));
const realObsNodes = await import("@repo/supabase/queries/obs-nodes/instances");
mock.module("@repo/supabase/queries/obs-nodes/instances", () => ({
  ...realObsNodes,
  getInstanceNode: async (_client: unknown, instanceId: string, userId: string) => {
    const row = instances[instanceId];
    return row && row.userId === userId ? { nodeId: row.nodeId, apiUrl: "http://node" } : null;
  },
}));

let jwks: JSONWebKeySet;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  process.env.NODE_TOKEN_SIGNING_JWK = JSON.stringify({ ...(await exportJWK(privateKey)), kid });
  jwks = { keys: [{ ...publicJwk, kid }] };
});

const { mintNodeTokenAction } = await import("./node-token");

test("signs a token for the node that hosts the user's instance", async () => {
  const { data } = await mintNodeTokenAction(MINE, "files");
  const { payload } = await jwtVerify(data!.token, createLocalJWKSet(jwks), { audience: "node-a", algorithms: ["EdDSA"] });
  expect(payload).toMatchObject({ sub: "user-1", scope: "files", iid: MINE, role: "user" });
});

test("refuses someone else's instance", async () => {
  expect(await mintNodeTokenAction(THEIRS, "files")).toEqual({ data: null, error: "Instance not found." });
});

test("refuses admin scopes", async () => {
  // @ts-expect-error the client can send any string
  expect(await mintNodeTokenAction(MINE, "admin:instances")).toEqual({ data: null, error: "Invalid request" });
});

test("refuses an instance id that isn't a uuid", async () => {
  expect(await mintNodeTokenAction("../instances", "files")).toEqual({ data: null, error: "Invalid request" });
});

test("refuses signed-out callers", async () => {
  signedIn = null;
  try {
    expect(await mintNodeTokenAction(MINE, "files")).toEqual({ data: null, error: "Unauthenticated" });
  } finally {
    signedIn = { id: "user-1" };
  }
});

test("refuses every scope once the plan is revoked", async () => {
  access = { canAccess: false, canInteract: false };
  try {
    for (const scope of ["instances:control", "ws-ticket", "files"] as const) {
      expect(await mintNodeTokenAction(MINE, scope)).toEqual({ data: null, error: "Your Cloud OBS plan isn't active." });
    }
  } finally {
    access = { canAccess: true, canInteract: true };
  }
});

test("a past_due plan can still control its instance but not create one", async () => {
  access = { canAccess: true, canInteract: false };
  try {
    expect((await mintNodeTokenAction(MINE, "instances:control")).data?.token).toBeString();
    expect(await mintNodeTokenAction(MINE, "instances:create")).toEqual({ data: null, error: "Your Cloud OBS plan isn't active." });
  } finally {
    access = { canAccess: true, canInteract: true };
  }
});
