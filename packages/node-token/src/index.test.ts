import { beforeAll, beforeEach, expect, test } from "bun:test";
import { calculateJwkThumbprint, createLocalJWKSet, decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify, type JSONWebKeySet } from "jose";
import { isAdminNodeScope, isUserNodeScope, NODE_TOKEN_ISSUER, resetSigningKey, signNodeToken } from "./index";

let jwks: JSONWebKeySet;
let kid: string;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const publicJwk = await exportJWK(publicKey);
  kid = await calculateJwkThumbprint(publicJwk);
  process.env.NODE_TOKEN_SIGNING_JWK = JSON.stringify({ ...(await exportJWK(privateKey)), kid });
  jwks = { keys: [{ ...publicJwk, kid, alg: "EdDSA" }] };
});

beforeEach(() => resetSigningKey());

test("signs a token the node can verify, bound to that node", async () => {
  const token = await signNodeToken({ nodeId: "node-a", userId: "user-1", scope: "instances:control", instanceId: "i-42", role: "user" });

  const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
    issuer: NODE_TOKEN_ISSUER,
    audience: "node-a",
    algorithms: ["EdDSA"],
  });
  expect(payload.sub).toBe("user-1");
  expect(payload.scope).toBe("instances:control");
  expect(payload.iid).toBe("i-42");
  expect(payload.role).toBe("user");
  expect(payload.exp! - payload.iat!).toBe(60);
  expect(typeof payload.jti).toBe("string");
  expect(decodeProtectedHeader(token).kid).toBe(kid);
});

test("another node rejects it", async () => {
  const token = await signNodeToken({ nodeId: "node-a", userId: "user-1", scope: "ws-ticket", instanceId: "i-42", role: "user" });
  await expect(
    jwtVerify(token, createLocalJWKSet(jwks), { issuer: NODE_TOKEN_ISSUER, audience: "node-b", algorithms: ["EdDSA"] }),
  ).rejects.toThrow();
});

test("an edited token fails the signature", async () => {
  const token = await signNodeToken({ nodeId: "node-a", userId: "user-1", scope: "files", instanceId: "i-42", role: "user" });
  const [header, , signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ iss: NODE_TOKEN_ISSUER, aud: "node-b", sub: "user-1", scope: "files", iid: "i-42", role: "admin", exp: 9999999999 }),
  ).toString("base64url");
  await expect(
    jwtVerify(`${header}.${forged}.${signature}`, createLocalJWKSet(jwks), { audience: "node-b", algorithms: ["EdDSA"] }),
  ).rejects.toThrow();
});

test("node-wide scopes carry no iid", async () => {
  const token = await signNodeToken({ nodeId: "node-a", userId: "admin-1", scope: "admin:ws-ticket", role: "admin" });
  const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), { audience: "node-a", algorithms: ["EdDSA"] });
  expect(payload.iid).toBeUndefined();
});

test("refuses to sign without a key", async () => {
  const saved = process.env.NODE_TOKEN_SIGNING_JWK;
  delete process.env.NODE_TOKEN_SIGNING_JWK;
  try {
    await expect(signNodeToken({ nodeId: "n", userId: "u", scope: "files", role: "user" })).rejects.toThrow("NODE_TOKEN_SIGNING_JWK is not set");
  } finally {
    process.env.NODE_TOKEN_SIGNING_JWK = saved;
  }
});

test("refuses a public key in place of the private one", async () => {
  const saved = process.env.NODE_TOKEN_SIGNING_JWK;
  process.env.NODE_TOKEN_SIGNING_JWK = JSON.stringify(jwks.keys[0]);
  try {
    await expect(signNodeToken({ nodeId: "n", userId: "u", scope: "files", role: "user" })).rejects.toThrow("Ed25519 private JWK");
  } finally {
    process.env.NODE_TOKEN_SIGNING_JWK = saved;
  }
});

test("user and admin scopes don't overlap", () => {
  expect(isUserNodeScope("files")).toBe(true);
  expect(isUserNodeScope("admin:instances")).toBe(false);
  expect(isAdminNodeScope("admin:instances")).toBe(true);
  expect(isAdminNodeScope("files")).toBe(false);
  expect(isUserNodeScope("anything")).toBe(false);
});
