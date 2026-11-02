import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  createServiceTokenVerifier,
  looksLikeJwt,
  resetSigningKey,
  SERVICE_TOKEN_AUDIENCE,
  SERVICE_TOKEN_ISSUER,
  serviceAuthHeader,
  signServiceToken,
  type ServiceJwk,
  type ServiceName,
  type ServiceTokenVerifier,
} from "./index";

type Pair = { signing: string; publicJwk: ServiceJwk; privateKey: CryptoKey };

async function makePair(svc: ServiceName): Promise<Pair> {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const pub = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(pub);
  return {
    signing: JSON.stringify({ ...(await exportJWK(privateKey)), kid, alg: "EdDSA", svc }),
    publicJwk: { ...pub, kid, alg: "EdDSA", svc },
    privateKey,
  };
}

let restApi: Pair;
let overlay: Pair;
let verify: ServiceTokenVerifier;

function useKey(pair: Pair | null) {
  if (pair) process.env.WS_SERVICE_SIGNING_JWK = pair.signing;
  else delete process.env.WS_SERVICE_SIGNING_JWK;
  resetSigningKey();
}

beforeAll(async () => {
  restApi = await makePair("rest-api");
  overlay = await makePair("web-overlay");
  verify = createServiceTokenVerifier({ keys: [restApi.publicJwk, overlay.publicJwk] });
});

beforeEach(() => useKey(restApi));

describe("sign and verify", () => {
  test("a service's token verifies as that service, for that action", async () => {
    const token = await signServiceToken("broadcast");
    expect(await verify(token, "broadcast")).toBe("rest-api");
  });

  test("a token signed for one action is refused for another", async () => {
    const token = await signServiceToken("broadcast");
    await expect(verify(token, "revoke")).rejects.toThrow();
  });

  test("a service can't do what its policy doesn't allow, even with a valid token", async () => {
    useKey(overlay);
    const token = await signServiceToken("revoke");
    await expect(verify(token, "revoke")).rejects.toThrow("web-overlay may not revoke");
  });

  test("a key can't claim to be another service", async () => {
    const forged = await new SignJWT({ scope: "broadcast" })
      .setProtectedHeader({ alg: "EdDSA", kid: overlay.publicJwk.kid })
      .setIssuer(SERVICE_TOKEN_ISSUER)
      .setAudience(SERVICE_TOKEN_AUDIENCE)
      .setSubject("rest-api")
      .setIssuedAt()
      .setExpirationTime("60s")
      .setJti("j")
      .sign(overlay.privateKey);
    await expect(verify(forged, "broadcast")).rejects.toThrow("another service");
  });

  test("an unknown key is refused", async () => {
    const stranger = await makePair("rest-api");
    useKey(stranger);
    await expect(verify(await signServiceToken("broadcast"), "broadcast")).rejects.toThrow();
  });

  test("an old token is refused", async () => {
    const old = await new SignJWT({ scope: "broadcast" })
      .setProtectedHeader({ alg: "EdDSA", kid: restApi.publicJwk.kid })
      .setIssuer(SERVICE_TOKEN_ISSUER)
      .setAudience(SERVICE_TOKEN_AUDIENCE)
      .setSubject("rest-api")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) + 600)
      .setJti("j")
      .sign(restApi.privateKey);
    await expect(verify(old, "broadcast")).rejects.toThrow();
  });

  test("the verifier refuses a private key in its key set", () => {
    const priv = JSON.parse(restApi.signing) as ServiceJwk;
    expect(() => createServiceTokenVerifier({ keys: [priv] })).toThrow("public keys only");
  });
});

describe("serviceAuthHeader", () => {
  test("prefers a signed token when the service has a key", async () => {
    const header = await serviceAuthHeader("broadcast", "legacy");
    expect(header?.startsWith("Bearer ")).toBe(true);
    expect(looksLikeJwt(header!.slice(7))).toBe(true);
  });

  test("falls back to the legacy secret without a key, and to null without either", async () => {
    useKey(null);
    expect(await serviceAuthHeader("broadcast", "legacy")).toBe("Bearer legacy");
    expect(await serviceAuthHeader("broadcast", undefined)).toBeNull();
  });
});
