import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createServiceTokenVerifier, resetSigningKey, type ServiceJwk, type ServiceTokenVerifier } from "@repo/service-token";

let isAdmin = true;
let adminChecks = 0;
// Spread the real exports: bun shares module mocks across test files.
const realAssertAdmin = await import("@/lib/auth/assert-admin");
mock.module("@/lib/auth/assert-admin", () => ({
  ...realAssertAdmin,
  assertAdmin: async () => {
    adminChecks++;
    if (!isAdmin) throw new Error("Not authorized");
    return "admin-user";
  },
}));

const { mintMonitorTokenAction } = await import("./monitor-token");

let signingJwk = "";
let verify: ServiceTokenVerifier;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const kid = "test-web-admin";
  signingJwk = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", pair.privateKey)), kid, alg: "EdDSA", svc: "web-admin" });
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  verify = createServiceTokenVerifier({ keys: [{ ...pub, kid, alg: "EdDSA", svc: "web-admin" } as ServiceJwk] });
});

afterAll(() => {
  delete process.env.WS_SERVICE_SIGNING_JWK;
  resetSigningKey();
});

beforeEach(() => {
  isAdmin = true;
  adminChecks = 0;
  process.env.WS_SERVICE_SIGNING_JWK = signingJwk;
  resetSigningKey();
});

describe("mintMonitorTokenAction", () => {
  test("an admin gets a token ws-server accepts for role=monitor", async () => {
    const res = await mintMonitorTokenAction();
    expect(res.error).toBeNull();
    expect(await verify(res.data!.token, "monitor")).toEqual({ service: "web-admin", claims: {} });
  });

  test("the token is good for the monitor only", async () => {
    const res = await mintMonitorTokenAction();
    await expect(verify(res.data!.token, "broadcast")).rejects.toThrow();
  });

  test("refuses without admin auth, before signing anything", async () => {
    isAdmin = false;
    expect(await mintMonitorTokenAction()).toEqual({ data: null, error: "Forbidden" });
    expect(adminChecks).toBe(1);
  });

  test("checks admin auth on every call", async () => {
    await mintMonitorTokenAction();
    await mintMonitorTokenAction();
    expect(adminChecks).toBe(2);
  });

  test("says so when this environment has no signing key", async () => {
    delete process.env.WS_SERVICE_SIGNING_JWK;
    const res = await mintMonitorTokenAction();
    expect(res.data).toBeNull();
    expect(res.error).not.toBe("Forbidden");
  });
});
