import { beforeAll, expect, mock, test } from "bun:test";
import { calculateJwkThumbprint, createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, type JSONWebKeySet } from "jose";

// The client picks both arguments of mintNodeTokenAction, so these pin what
// the server refuses: other people's instances and admin scopes.

let signedIn: { id: string } | null = { id: "user-1" };
const instances: Record<string, { userId: string; nodeId: string }> = {
  "i-42": { userId: "user-1", nodeId: "node-a" },
  "i-99": { userId: "user-2", nodeId: "node-b" },
};

mock.module("@/lib/auth", () => ({
  tryAuthContext: async () => (signedIn ? { user: signedIn } : null),
}));
mock.module("@repo/supabase/next/admin", () => ({ createAdminClient: () => ({}) }));
mock.module("@repo/supabase/queries/obs-nodes", () => ({
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
  const { data } = await mintNodeTokenAction("i-42", "files");
  const { payload } = await jwtVerify(data!.token, createLocalJWKSet(jwks), { audience: "node-a", algorithms: ["EdDSA"] });
  expect(payload).toMatchObject({ sub: "user-1", scope: "files", iid: "i-42", role: "user" });
});

test("refuses someone else's instance", async () => {
  expect(await mintNodeTokenAction("i-99", "files")).toEqual({ data: null, error: "Instance not found." });
});

test("refuses admin scopes", async () => {
  // @ts-expect-error the client can send any string
  expect(await mintNodeTokenAction("i-42", "admin:instances")).toEqual({ data: null, error: "Invalid scope" });
});

test("refuses signed-out callers", async () => {
  signedIn = null;
  try {
    expect(await mintNodeTokenAction("i-42", "files")).toEqual({ data: null, error: "Unauthenticated" });
  } finally {
    signedIn = { id: "user-1" };
  }
});
