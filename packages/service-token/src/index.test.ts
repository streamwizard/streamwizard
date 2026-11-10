import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, decodeJwt, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  createServiceTokenVerifier,
  looksLikeJwt,
  resetSigningKey,
  SCOPE_AUDIENCE,
  SERVICE_AUDIENCES,
  SERVICE_SCOPES,
  SERVICE_TOKEN_ISSUER,
  serviceAuthHeader,
  signServiceToken,
  type ServiceAudience,
  type ServiceJwk,
  type ServiceName,
  type ServiceScope,
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
  verify = createServiceTokenVerifier({ keys: [restApi.publicJwk, overlay.publicJwk] }, "ws-server");
});

beforeEach(() => useKey(restApi));

describe("sign and verify", () => {
  test("a service's token verifies as that service, for that action", async () => {
    const token = await signServiceToken("broadcast");
    expect(await verify(token, "broadcast")).toEqual({ service: "rest-api", claims: {} });
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
      .setAudience("ws-server")
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
      .setAudience("ws-server")
      .setSubject("rest-api")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) + 600)
      .setJti("j")
      .sign(restApi.privateKey);
    await expect(verify(old, "broadcast")).rejects.toThrow();
  });

  test("the verifier refuses a private key in its key set", () => {
    const priv = JSON.parse(restApi.signing) as ServiceJwk;
    expect(() => createServiceTokenVerifier({ keys: [priv] }, "ws-server")).toThrow("public keys only");
  });
});

describe("ingest-node tokens", () => {
  test("carry the node they were signed for", async () => {
    const token = await signServiceToken("ingest-node", { node: "node-a" });
    expect(await verify(token, "ingest-node")).toEqual({ service: "rest-api", claims: { node: "node-a" } });
  });

  test("can't be signed without a node", async () => {
    await expect(signServiceToken("ingest-node")).rejects.toThrow("node claim");
    await expect(signServiceToken("ingest-node", { node: "" })).rejects.toThrow("node claim");
  });

  test("are refused without a node even when the signature is valid", async () => {
    const bare = await new SignJWT({ scope: "ingest-node" })
      .setProtectedHeader({ alg: "EdDSA", kid: restApi.publicJwk.kid })
      .setIssuer(SERVICE_TOKEN_ISSUER)
      .setAudience("ws-server")
      .setSubject("rest-api")
      .setIssuedAt()
      .setExpirationTime("60s")
      .setJti("j")
      .sign(restApi.privateKey);
    await expect(verify(bare, "ingest-node")).rejects.toThrow("node claim");
  });

  test("only rest-api may issue them", async () => {
    useKey(overlay);
    await expect(verify(await signServiceToken("ingest-node", { node: "node-a" }), "ingest-node")).rejects.toThrow(
      "web-overlay may not ingest-node",
    );
  });

  test("a token for another action can't open an ingest-node socket", async () => {
    await expect(verify(await signServiceToken("broadcast"), "ingest-node")).rejects.toThrow();
  });

  test("extra claims can't replace the token's own", async () => {
    await expect(signServiceToken("broadcast", { sub: "web-admin" })).rejects.toThrow("reserved");
    await expect(signServiceToken("broadcast", { scope: "bot" })).rejects.toThrow("reserved");
  });
});

describe("audiences", () => {
  let admin: Pair;
  const verifiers = {} as Record<ServiceAudience, ServiceTokenVerifier>;

  beforeAll(async () => {
    admin = await makePair("web-admin");
    for (const audience of SERVICE_AUDIENCES) verifiers[audience] = createServiceTokenVerifier({ keys: [admin.publicJwk] }, audience);
  });

  beforeEach(() => useKey(admin));

  test("every scope belongs to exactly one service", () => {
    expect(Object.keys(SCOPE_AUDIENCE).sort()).toEqual([...SERVICE_SCOPES].sort());
  });

  test("a token is addressed to the service that handles its scope", async () => {
    const token = await signServiceToken("backups");
    expect(decodeJwt(token).aud).toBe("rest-api");
    expect(decodeJwt(await signServiceToken("discord-guilds")).aud).toBe("discord-bot");
    expect(decodeJwt(await signServiceToken("monitor")).aud).toBe("ws-server");
  });

  test("web-admin's tokens verify at their own service", async () => {
    expect(await verifiers["rest-api"](await signServiceToken("backups"), "backups")).toEqual({ service: "web-admin", claims: {} });
    expect(await verifiers["discord-bot"](await signServiceToken("discord-guilds"), "discord-guilds")).toEqual({
      service: "web-admin",
      claims: {},
    });
  });

  test("a token for one service is refused by every other", async () => {
    // Same key, same scope name in the claim: only the audience differs.
    async function forScope(scope: ServiceScope, audience: ServiceAudience) {
      return new SignJWT({ scope })
        .setProtectedHeader({ alg: "EdDSA", kid: admin.publicJwk.kid })
        .setIssuer(SERVICE_TOKEN_ISSUER)
        .setAudience(audience)
        .setSubject("web-admin")
        .setIssuedAt()
        .setExpirationTime("60s")
        .setJti("j")
        .sign(admin.privateKey);
    }
    await expect(verifiers["rest-api"](await forScope("backups", "ws-server"), "backups")).rejects.toThrow();
    await expect(verifiers["rest-api"](await forScope("backups", "discord-bot"), "backups")).rejects.toThrow();
    await expect(verifiers["discord-bot"](await forScope("discord-guilds", "rest-api"), "discord-guilds")).rejects.toThrow();
    await expect(verifiers["ws-server"](await forScope("monitor", "rest-api"), "monitor")).rejects.toThrow();
  });

  test("a service can't be asked to check another service's action", async () => {
    const token = await signServiceToken("backups");
    await expect(verifiers["discord-bot"](token, "backups")).rejects.toThrow("discord-bot does not handle backups");
    await expect(verifiers["ws-server"](await signServiceToken("monitor"), "monitor")).resolves.toBeTruthy();
    await expect(verifiers["rest-api"](await signServiceToken("discord-guilds"), "backups")).rejects.toThrow();
  });

  test("only web-admin may call rest-api /internal/* and the discord-bot API", async () => {
    useKey(restApi);
    const restVerify = createServiceTokenVerifier({ keys: [restApi.publicJwk] }, "rest-api");
    await expect(restVerify(await signServiceToken("backups"), "backups")).rejects.toThrow("rest-api may not backups");
    const botVerify = createServiceTokenVerifier({ keys: [restApi.publicJwk] }, "discord-bot");
    await expect(botVerify(await signServiceToken("discord-guilds"), "discord-guilds")).rejects.toThrow(
      "rest-api may not discord-guilds",
    );
  });
});

describe("serviceAuthHeader", () => {
  test("prefers a signed token when the service has a key", async () => {
    const header = await serviceAuthHeader("broadcast");
    expect(header?.startsWith("Bearer ")).toBe(true);
    expect(looksLikeJwt(header!.slice(7))).toBe(true);
  });

  test("is null without a key: there is no shared-secret fallback", async () => {
    useKey(null);
    expect(await serviceAuthHeader("broadcast")).toBeNull();
  });
});
