import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } from "jose";
import { Hono } from "hono";
import {
  createServiceAuth,
  resetSigningKey,
  SERVICE_TOKEN_ISSUER,
  signServiceToken,
  type ServiceJwk,
  type ServiceName,
} from "@repo/service-token";
import { internalAuth } from "@/middleware/internal-auth";

const SECRET = "l".repeat(40);
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
function craft({ scope = "backups", audience = "rest-api", iat = Math.floor(Date.now() / 1000) } = {}) {
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

function app(opts: { jwks?: boolean; legacySecret?: string } = {}) {
  const auth = createServiceAuth({
    audience: "rest-api",
    jwks: opts.jwks === false ? undefined : { keys: [admin.publicJwk, restApi.publicJwk] },
  });
  const a = new Hono();
  a.use("*", internalAuth({ scope: "backups", auth, legacySecret: opts.legacySecret }));
  a.get("/", (c) => c.text("ok"));
  return a;
}

async function status(a: Hono, authorization?: string) {
  const res = await a.request("/", authorization === undefined ? undefined : { headers: { authorization } });
  return res.status;
}

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

describe("internalAuth with service tokens", () => {
  test("lets web-admin's backups token through", async () => {
    expect(await status(app(), `Bearer ${await signServiceToken("backups")}`)).toBe(200);
  });

  test("refuses a missing header or another scheme", async () => {
    expect(await status(app())).toBe(401);
    expect(await status(app(), "Bearer ")).toBe(401);
    expect(await status(app(), `Basic ${await signServiceToken("backups")}`)).toBe(401);
  });

  test("refuses an expired token", async () => {
    expect(await status(app(), `Bearer ${await craft({ iat: Math.floor(Date.now() / 1000) - 600 })}`)).toBe(401);
  });

  test("refuses a token addressed to another service", async () => {
    expect(await status(app(), `Bearer ${await craft({ audience: "ws-server" })}`)).toBe(401);
    expect(await status(app(), `Bearer ${await craft({ audience: "discord-bot" })}`)).toBe(401);
    // Real tokens web-admin signs for ws-server and the bot.
    expect(await status(app(), `Bearer ${await signServiceToken("monitor")}`)).toBe(401);
    expect(await status(app(), `Bearer ${await signServiceToken("discord-guilds")}`)).toBe(401);
  });

  test("refuses a token for another action", async () => {
    expect(await status(app(), `Bearer ${await craft({ scope: "monitor" })}`)).toBe(401);
  });

  test("refuses a service the policy doesn't allow here", async () => {
    useKey(restApi);
    expect(await status(app(), `Bearer ${await signServiceToken("backups")}`)).toBe(401);
  });

  test("answers 404 when the environment has no keys and no secret", async () => {
    expect(await status(app({ jwks: false }), `Bearer ${await signServiceToken("backups")}`)).toBe(404);
    expect(await status(app({ jwks: false }))).toBe(404);
  });
});

describe("internalAuth during the move off the shared secret", () => {
  test("still takes the old secret next to tokens", async () => {
    const a = app({ legacySecret: SECRET });
    expect(await status(a, `Bearer ${SECRET}`)).toBe(200);
    expect(await status(a, `Bearer ${await signServiceToken("backups")}`)).toBe(200);
    expect(await status(a, "Bearer not-the-secret")).toBe(401);
    expect(await status(a)).toBe(401);
  });

  test("takes the secret alone when there are no keys yet", async () => {
    const a = app({ jwks: false, legacySecret: SECRET });
    expect(await status(a, `Bearer ${SECRET}`)).toBe(200);
    expect(await status(a, `Bearer ${await signServiceToken("backups")}`)).toBe(401);
  });

  test("never takes the secret when none is configured", async () => {
    expect(await status(app(), `Bearer ${SECRET}`)).toBe(401);
  });
});
