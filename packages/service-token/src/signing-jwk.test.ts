import { describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { isServiceSigningJwk, parseServiceSigningJwk } from "./signing-jwk";

async function signingJwk(extra: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const pub = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(pub);
  return { priv: { ...(await exportJWK(privateKey)), kid, alg: "EdDSA", svc: "web-admin", ...extra }, pub: { ...pub, kid } };
}

describe("parseServiceSigningJwk", () => {
  test("accepts an Ed25519 private JWK with a kid and a known svc", async () => {
    const { priv } = await signingJwk();
    expect(parseServiceSigningJwk(JSON.stringify(priv))).toEqual(priv as never);
    expect(isServiceSigningJwk(JSON.stringify(priv))).toBe(true);
  });

  test("refuses a public key, an unknown or missing svc, a missing kid, and non-JSON", async () => {
    const { priv, pub } = await signingJwk();
    expect(isServiceSigningJwk(JSON.stringify({ ...pub, svc: "web-admin" }))).toBe(false);
    expect(isServiceSigningJwk(JSON.stringify({ ...priv, svc: "ws-server" }))).toBe(false);
    expect(isServiceSigningJwk(JSON.stringify({ ...priv, svc: undefined }))).toBe(false);
    expect(isServiceSigningJwk(JSON.stringify({ ...priv, kid: "" }))).toBe(false);
    expect(isServiceSigningJwk(JSON.stringify({ ...priv, crv: "P-256" }))).toBe(false);
    expect(isServiceSigningJwk("not json")).toBe(false);
    expect(isServiceSigningJwk("null")).toBe(false);
    expect(isServiceSigningJwk('"a string"')).toBe(false);
  });
});
