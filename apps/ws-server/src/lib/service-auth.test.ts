import { beforeAll, describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { resetSigningKey, signServiceToken, type ServiceJwk, type ServiceName, type ServiceScope } from "@repo/service-token";

process.env.NODE_ENV = "development";
process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SECRET_KEY ??= "test-secret";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-key";

const { createServiceAuth } = await import("./service-auth");

const signing = new Map<ServiceName, string>();
const keys: ServiceJwk[] = [];

beforeAll(async () => {
  for (const svc of ["rest-api", "web-overlay", "obs-auto-switcher", "streamwizard-bot"] as ServiceName[]) {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const pub = await exportJWK(publicKey);
    const kid = await calculateJwkThumbprint(pub);
    signing.set(svc, JSON.stringify({ ...(await exportJWK(privateKey)), kid, alg: "EdDSA", svc }));
    keys.push({ ...pub, kid, alg: "EdDSA", svc });
  }
});

async function bearer(svc: ServiceName, scope: ServiceScope) {
  process.env.WS_SERVICE_SIGNING_JWK = signing.get(svc)!;
  resetSigningKey();
  return `Bearer ${await signServiceToken(scope)}`;
}

const legacy = { consumerSecret: "shared-consumer", botSecret: "service-role" };

describe("service tokens", () => {
  test("each service gets exactly its own actions", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: true });
    const cases: [ServiceName, ServiceScope, boolean][] = [
      ["rest-api", "broadcast", true],
      ["rest-api", "revoke", true],
      ["rest-api", "consumer", false],
      ["rest-api", "bot", false],
      ["web-overlay", "broadcast", true],
      ["web-overlay", "revoke", false],
      ["obs-auto-switcher", "consumer", true],
      ["obs-auto-switcher", "bot", true],
      ["obs-auto-switcher", "broadcast", false],
      ["streamwizard-bot", "bot", true],
      ["streamwizard-bot", "consumer", false],
    ];
    for (const [svc, scope, allowed] of cases) {
      const res = await auth.authorize(await bearer(svc, scope), scope);
      expect({ svc, scope, ok: res.ok }).toEqual({ svc, scope, ok: allowed });
    }
  });

  test("the verified service name comes back for logging", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: true });
    expect(await auth.authorize(await bearer("rest-api", "broadcast"), "broadcast")).toEqual({
      ok: true,
      service: "rest-api",
      legacy: false,
      claims: {},
    });
  });

  test("a token for one action can't be replayed on another", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: true });
    expect((await auth.authorize(await bearer("rest-api", "broadcast"), "revoke")).ok).toBe(false);
  });

  test("no header, or no Bearer, is refused", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: true });
    expect(await auth.authorize(null, "broadcast")).toEqual({ ok: false, reason: "missing" });
    expect((await auth.authorize("Basic abc", "broadcast")).ok).toBe(false);
  });
});

describe("legacy secrets", () => {
  test("still work while not required, each only for its own actions", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: false, ...legacy });
    expect((await auth.authorize("Bearer shared-consumer", "broadcast")).ok).toBe(true);
    expect((await auth.authorize("Bearer shared-consumer", "consumer")).ok).toBe(true);
    expect((await auth.authorize("Bearer service-role", "bot")).ok).toBe(true);
    expect((await auth.authorize("Bearer service-role", "broadcast")).ok).toBe(false);
    expect((await auth.authorize("Bearer shared-consumer", "bot")).ok).toBe(false);
  });

  test("are refused once required, but service tokens keep working", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: true, ...legacy });
    expect((await auth.authorize("Bearer shared-consumer", "broadcast")).ok).toBe(false);
    expect((await auth.authorize("Bearer service-role", "bot")).ok).toBe(false);
    expect((await auth.authorize(await bearer("streamwizard-bot", "bot"), "bot")).ok).toBe(true);
  });

  test("the new ingest actions never accept a shared secret", async () => {
    const auth = createServiceAuth({ jwks: { keys }, required: false, ...legacy });
    expect((await auth.authorize("Bearer shared-consumer", "ingest-node")).ok).toBe(false);
    expect((await auth.authorize("Bearer service-role", "ingest-node")).ok).toBe(false);
    expect((await auth.authorize("Bearer shared-consumer", "ingest-sessions")).ok).toBe(false);
    expect(createServiceAuth({ required: false, ...legacy }).configured("ingest-node")).toBe(false);
  });

  test("configured() says when an action has no way in at all", () => {
    expect(createServiceAuth({ required: true, ...legacy }).configured("broadcast")).toBe(false);
    expect(createServiceAuth({ required: false, ...legacy }).configured("broadcast")).toBe(true);
    expect(createServiceAuth({ jwks: { keys }, required: true }).configured("broadcast")).toBe(true);
  });
});
