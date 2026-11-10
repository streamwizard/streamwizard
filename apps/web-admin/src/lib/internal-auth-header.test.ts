import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { decodeJwt } from "jose";
import { createServiceTokenVerifier, resetSigningKey, type ServiceJwk, type ServiceTokenVerifier } from "@repo/service-token";

const env: { WS_SERVICE_SIGNING_JWK?: string } = {};
mock.module("@/lib/env", () => ({ env }));

const { canCallInternal, internalAuthHeader } = await import("./internal-auth-header");

const SECRET = "o".repeat(40);
const previousKey = process.env.WS_SERVICE_SIGNING_JWK;
let signingJwk = "";
let verifyAtRestApi: ServiceTokenVerifier;
let verifyAtBot: ServiceTokenVerifier;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const kid = "test-web-admin";
  signingJwk = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", pair.privateKey)), kid, alg: "EdDSA", svc: "web-admin" });
  const pub = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "EdDSA", svc: "web-admin" } as ServiceJwk;
  verifyAtRestApi = createServiceTokenVerifier({ keys: [pub] }, "rest-api");
  verifyAtBot = createServiceTokenVerifier({ keys: [pub] }, "discord-bot");
});

beforeEach(() => {
  env.WS_SERVICE_SIGNING_JWK = signingJwk;
  process.env.WS_SERVICE_SIGNING_JWK = signingJwk;
  resetSigningKey();
});

afterAll(() => {
  if (previousKey === undefined) delete process.env.WS_SERVICE_SIGNING_JWK;
  else process.env.WS_SERVICE_SIGNING_JWK = previousKey;
  resetSigningKey();
});

const tokenOf = (header: string | null) => header!.slice("Bearer ".length);

describe("internalAuthHeader", () => {
  test("signs a token rest-api accepts for backups", async () => {
    const token = tokenOf(await internalAuthHeader("backups", undefined));
    expect(decodeJwt(token).aud).toBe("rest-api");
    expect(await verifyAtRestApi(token, "backups")).toEqual({ service: "web-admin", claims: {} });
    await expect(verifyAtBot(token, "discord-guilds")).rejects.toThrow();
  });

  test("signs a token the bot accepts for its guild routes", async () => {
    const token = tokenOf(await internalAuthHeader("discord-guilds", undefined));
    expect(await verifyAtBot(token, "discord-guilds")).toEqual({ service: "web-admin", claims: {} });
    await expect(verifyAtRestApi(token, "backups")).rejects.toThrow();
  });

  test("signs a fresh token per call", async () => {
    const a = tokenOf(await internalAuthHeader("backups", undefined));
    const b = tokenOf(await internalAuthHeader("backups", undefined));
    expect(decodeJwt(a).jti).not.toBe(decodeJwt(b).jti);
  });

  test("sends the old secret while it is still set", async () => {
    expect(await internalAuthHeader("backups", SECRET)).toBe(`Bearer ${SECRET}`);
    expect(canCallInternal(SECRET)).toBe(true);
  });

  test("is null without a key or a secret", async () => {
    delete env.WS_SERVICE_SIGNING_JWK;
    expect(await internalAuthHeader("backups", undefined)).toBeNull();
    expect(canCallInternal(undefined)).toBe(false);
  });
});
