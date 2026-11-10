import { beforeAll, describe, expect, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import {
  createServiceAuth as createAuth,
  resetSigningKey,
  signServiceToken,
  type ServiceJwk,
  type ServiceName,
  type ServiceScope,
} from "@repo/service-token";

// ws-server's checks, as wired in ./service-auth (audience ws-server).
const createServiceAuth = (config: { jwks?: { keys: ServiceJwk[] } }) => createAuth({ audience: "ws-server", ...config });

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

describe("service tokens", () => {
  test("each service gets exactly its own actions", async () => {
    const auth = createServiceAuth({ jwks: { keys } });
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
    const auth = createServiceAuth({ jwks: { keys } });
    expect(await auth.authorize(await bearer("rest-api", "broadcast"), "broadcast")).toEqual({
      ok: true,
      service: "rest-api",
      claims: {},
    });
  });

  test("a token for one action can't be replayed on another", async () => {
    const auth = createServiceAuth({ jwks: { keys } });
    expect((await auth.authorize(await bearer("rest-api", "broadcast"), "revoke")).ok).toBe(false);
  });

  test("no header, or no Bearer, is refused", async () => {
    const auth = createServiceAuth({ jwks: { keys } });
    expect(await auth.authorize(null, "broadcast")).toEqual({ ok: false, reason: "missing" });
    expect((await auth.authorize("Basic abc", "broadcast")).ok).toBe(false);
  });
});

describe("shared secrets", () => {
  test("are never accepted, for any action", async () => {
    const auth = createServiceAuth({ jwks: { keys } });
    for (const scope of ["broadcast", "revoke", "consumer", "bot", "ingest-node", "ingest-sessions", "monitor"] as ServiceScope[]) {
      expect((await auth.authorize("Bearer shared-consumer", scope)).ok).toBe(false);
    }
  });

  test("without service keys nothing is configured and nothing gets in", async () => {
    const auth = createServiceAuth({});
    expect(auth.configured("broadcast")).toBe(false);
    expect((await auth.authorize(await bearer("rest-api", "broadcast"), "broadcast")).ok).toBe(false);
  });

  test("configured() is true once service keys are set", () => {
    expect(createServiceAuth({ jwks: { keys } }).configured("broadcast")).toBe(true);
  });
});
