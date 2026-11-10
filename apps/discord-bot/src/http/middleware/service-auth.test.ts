import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  createServiceAuth,
  resetSigningKey,
  SERVICE_TOKEN_ISSUER,
  signServiceToken,
  type ServiceJwk,
  type ServiceName,
} from "@repo/service-token";
import { serviceTokenAuth } from "./service-auth";

const SECRET = "s3cret-for-the-discord-bot-api";
const previousKey = process.env.WS_SERVICE_SIGNING_JWK;

type Pair = { signing: string; publicJwk: ServiceJwk; privateKey: CryptoKey };
let admin: Pair;
let restApi: Pair;

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

function useKey(pair: Pair) {
  process.env.WS_SERVICE_SIGNING_JWK = pair.signing;
  resetSigningKey();
}

/** A token signed with web-admin's key, with full control over its claims. */
function craft({ scope = "discord-guilds", audience = "discord-bot", iat = Math.floor(Date.now() / 1000) } = {}) {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: "EdDSA", kid: admin.publicJwk.kid })
    .setIssuer(SERVICE_TOKEN_ISSUER)
    .setAudience(audience)
    .setSubject("web-admin")
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60)
    .setJti(crypto.randomUUID())
    .sign(admin.privateKey);
}

let reached = 0;
function app(legacySecret?: string) {
  const auth = createServiceAuth({ audience: "discord-bot", jwks: { keys: [admin.publicJwk, restApi.publicJwk] } });
  const a = new Hono();
  a.use("*", serviceTokenAuth({ scope: "discord-guilds", auth, legacySecret }));
  a.get("/ping", (c) => {
    reached++;
    return c.json({ ok: true });
  });
  return a;
}

async function call(a: Hono, authorization?: string) {
  reached = 0;
  const res = await a.request("/ping", authorization === undefined ? undefined : { headers: { Authorization: authorization } });
  return { status: res.status, reached };
}

const OK = { status: 200, reached: 1 };
const REFUSED = { status: 401, reached: 0 };

beforeAll(async () => {
  admin = await makePair("web-admin");
  restApi = await makePair("rest-api");
});

beforeEach(() => useKey(admin));

afterAll(() => {
  if (previousKey === undefined) delete process.env.WS_SERVICE_SIGNING_JWK;
  else process.env.WS_SERVICE_SIGNING_JWK = previousKey;
  resetSigningKey();
});

describe("serviceTokenAuth", () => {
  test("lets web-admin's discord-guilds token through", async () => {
    expect(await call(app(), `Bearer ${await signServiceToken("discord-guilds")}`)).toEqual(OK);
  });

  test("refuses a missing header, an empty bearer and other schemes", async () => {
    expect(await call(app())).toEqual(REFUSED);
    expect(await call(app(), "Bearer ")).toEqual(REFUSED);
    expect(await call(app(), `Basic ${await signServiceToken("discord-guilds")}`)).toEqual(REFUSED);
  });

  test("refuses an expired token", async () => {
    expect(await call(app(), `Bearer ${await craft({ iat: Math.floor(Date.now() / 1000) - 600 })}`)).toEqual(REFUSED);
  });

  test("refuses a token addressed to another service", async () => {
    expect(await call(app(), `Bearer ${await craft({ audience: "rest-api" })}`)).toEqual(REFUSED);
    expect(await call(app(), `Bearer ${await craft({ audience: "ws-server" })}`)).toEqual(REFUSED);
    expect(await call(app(), `Bearer ${await signServiceToken("backups")}`)).toEqual(REFUSED);
    expect(await call(app(), `Bearer ${await signServiceToken("monitor")}`)).toEqual(REFUSED);
  });

  test("refuses a token for another action", async () => {
    expect(await call(app(), `Bearer ${await craft({ scope: "broadcast" })}`)).toEqual(REFUSED);
  });

  test("refuses a service the policy doesn't allow here", async () => {
    useKey(restApi);
    expect(await call(app(), `Bearer ${await signServiceToken("discord-guilds")}`)).toEqual(REFUSED);
  });

  test("never takes a secret when none is configured", async () => {
    expect(await call(app(), `Bearer ${SECRET}`)).toEqual(REFUSED);
  });
});

describe("serviceTokenAuth during the move off the shared secret", () => {
  test("takes the old secret and tokens side by side", async () => {
    const a = app(SECRET);
    expect(await call(a, `Bearer ${SECRET}`)).toEqual(OK);
    expect(await call(a, `Bearer  ${SECRET} `)).toEqual(OK);
    expect(await call(a, `Bearer ${await signServiceToken("discord-guilds")}`)).toEqual(OK);
  });

  test("refuses a wrong secret, a prefix or an extension of it", async () => {
    const a = app(SECRET);
    expect(await call(a, "Bearer not-the-secret")).toEqual(REFUSED);
    expect(await call(a, `Bearer ${SECRET.slice(0, -1)}`)).toEqual(REFUSED);
    expect(await call(a, `Bearer ${SECRET}x`)).toEqual(REFUSED);
    expect(await call(a, SECRET)).toEqual(REFUSED);
    expect(await call(a, `Basic ${SECRET}`)).toEqual(REFUSED);
  });
});
