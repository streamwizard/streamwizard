import { describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { createServiceTokenVerifier } from "./index";
import { serviceJwksJson, serviceJwksJsonSchema, serviceJwksSchema } from "./jwks";

async function publicKey(svc = "rest-api") {
  const { publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const jwk = await exportJWK(publicKey);
  return { ...jwk, kid: await calculateJwkThumbprint(jwk), alg: "EdDSA", use: "sig", svc };
}

describe("serviceJwksSchema", () => {
  test("a set of public keys passes and keeps the extra JWK fields", async () => {
    const key = await publicKey();
    const parsed = serviceJwksJsonSchema.safeParse(JSON.stringify({ keys: [key] }));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.keys[0] as unknown).toEqual(key);
    // The parsed set is what the verifier takes.
    expect(() => createServiceTokenVerifier(parsed.data!, "ws-server")).not.toThrow();
  });

  test("private key material is refused", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const jwk = await exportJWK(privateKey);
    expect(serviceJwksSchema.safeParse({ keys: [{ ...jwk, kid: "k1", svc: "rest-api" }] }).success).toBe(false);
  });

  test("unknown services, other key types and missing fields are refused", async () => {
    const key = await publicKey();
    const bad = [
      { ...key, svc: "someone-else" },
      { ...key, kty: "RSA" },
      { ...key, crv: "X25519" },
      { ...key, kid: "" },
      { ...key, x: undefined },
      { ...key, kid: "k".repeat(129) },
    ];
    for (const k of bad) expect(serviceJwksSchema.safeParse({ keys: [k] }).success).toBe(false);
    expect(serviceJwksSchema.safeParse({ keys: [] }).success).toBe(false);
    expect(serviceJwksSchema.safeParse({}).success).toBe(false);
  });

  test("text that isn't JSON fails as a parse issue, not a throw", () => {
    const parsed = serviceJwksJsonSchema.safeParse("{not json");
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("WS_SERVICE_JWKS is not valid JSON");
    expect(serviceJwksJson("REST_API_SERVICE_JWKS").safeParse("nope").error?.issues[0]?.message).toBe(
      "REST_API_SERVICE_JWKS is not valid JSON",
    );
  });
});
