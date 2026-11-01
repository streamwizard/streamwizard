import { beforeAll, beforeEach, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { resetSigningKey, signNodeToken } from "@repo/node-token";
import { checkInstanceCreateToken, resetInstanceCreateTokenState } from "./instance-create-token";
import type { NodeTokenJwks } from "../../schemas/node-token-jwks";

let jwks: NodeTokenJwks;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  process.env.NODE_TOKEN_SIGNING_JWK = JSON.stringify({ ...(await exportJWK(privateKey)), kid });
  jwks = { keys: [{ kty: "OKP", crv: "Ed25519", x: publicJwk.x!, kid, alg: "EdDSA" }] };
});

beforeEach(() => {
  resetSigningKey();
  resetInstanceCreateTokenState();
});

const createToken = (overrides: Partial<Parameters<typeof signNodeToken>[0]> = {}) =>
  signNodeToken({ nodeId: "node-a", userId: "user-1", scope: "instances:create", role: "user", ...overrides });

const check = (token: string | undefined, extra: Partial<Parameters<typeof checkInstanceCreateToken>[0]> = {}) =>
  checkInstanceCreateToken({ token, nodeId: "node-a", userId: "user-1", jwks, required: true, ...extra });

test("accepts the user's own create token for this node", async () => {
  expect(await check(await createToken())).toEqual({ ok: true });
});

test("refuses a token for another user", async () => {
  expect(await check(await createToken({ userId: "user-2" }))).toMatchObject({ ok: false, status: 403 });
});

test("refuses a token for another node", async () => {
  expect(await check(await createToken({ nodeId: "node-b" }))).toMatchObject({ ok: false, status: 401 });
});

test("refuses a token with another scope", async () => {
  expect(await check(await createToken({ scope: "instances:control", instanceId: "i-1" }))).toMatchObject({ ok: false, status: 403 });
});

test("refuses an admin token", async () => {
  expect(await check(await createToken({ role: "admin" }))).toMatchObject({ ok: false, status: 403 });
});

test("a token creates one row only", async () => {
  const token = await createToken();
  expect(await check(token)).toEqual({ ok: true });
  expect(await check(token)).toMatchObject({ ok: false, status: 401 });
});

test("refuses garbage", async () => {
  expect(await check("not-a-jwt")).toMatchObject({ ok: false, status: 401 });
});

test("a missing token is refused once required", async () => {
  expect(await check(undefined)).toMatchObject({ ok: false, status: 401 });
});

test("a missing token is let through while not required", async () => {
  expect(await check(undefined, { required: false })).toEqual({ ok: true });
});

test("a sent token is checked even while not required", async () => {
  expect(await check(await createToken({ userId: "user-2" }), { required: false })).toMatchObject({ ok: false, status: 403 });
});

test("a sent token can't be checked without keys", async () => {
  expect(await check(await createToken(), { jwks: null })).toMatchObject({ ok: false, status: 503 });
});
