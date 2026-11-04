import { beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";
import { resetSigningKey, signServiceToken, type ServiceJwk, type ServiceName, type ServiceScope } from "@repo/service-token";

process.env.NODE_ENV = "development";
process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SECRET_KEY ??= "test-secret";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-key";

const calls = { getUser: 0, sceneLookup: 0 };

mock.module("@repo/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => {
        calls.getUser++;
        return Promise.resolve({ data: { user: null } });
      },
    },
  },
}));
mock.module("@repo/supabase/queries/overlays/overlays", () => ({
  getOverlaySceneBySubscriberToken: () => {
    calls.sceneLookup++;
    return Promise.resolve({ data: null });
  },
  selectSceneOwnersByTokens: () => Promise.resolve({ data: [] }),
}));

// The real verifier with test keys. Swappable, so a test can stand in for an
// environment without WS_SERVICE_JWKS. Bun shares module mocks across files,
// so the real exports stay in place.
const realServiceAuth = await import("@/middleware/service-auth");
type ServiceAuth = ReturnType<typeof realServiceAuth.createServiceAuth>;
let serviceAuth: ServiceAuth = realServiceAuth.createServiceAuth({});
mock.module("@/middleware/service-auth", () => ({
  ...realServiceAuth,
  serviceAuthConfigured: (scope: ServiceScope) => serviceAuth.configured(scope),
  authorizeService: (header: string | null, scope: ServiceScope) => serviceAuth.authorize(header, scope),
}));

const { handleUpgrade } = await import("./upgrade");

let upgraded: { data: Record<string, unknown> } | null = null;
const server = {
  upgrade: (_req: Request, opts: { data: Record<string, unknown> }) => {
    upgraded = opts;
    return true;
  },
  requestIP: () => ({ address: "10.0.0.1" }),
} as never;

function upgrade(role: string, token: string, ip: string) {
  const url = `http://ws.local/ws?role=${role}&token=${encodeURIComponent(token)}`;
  return handleUpgrade(new Request(url, { headers: { "cf-connecting-ip": ip } }), server);
}

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";
const SCENE = "a".repeat(64);

beforeEach(() => {
  calls.getUser = 0;
  calls.sceneLookup = 0;
  upgraded = null;
});

describe("anonymous upgrades", () => {
  for (const role of ["subscriber"]) {
    test(`${role}: a token of neither shape never reaches Supabase`, async () => {
      const res = await upgrade(role, "not-a-token", `shape-${role}`);
      expect(res?.status).toBe(401);
      expect(calls).toEqual({ getUser: 0, sceneLookup: 0 });
    });

    test(`${role}: a JWT-shaped token only asks GoTrue`, async () => {
      await upgrade(role, JWT, `jwt-${role}`);
      expect(calls).toEqual({ getUser: 1, sceneLookup: 0 });
    });

    test(`${role}: a 64-hex token only looks up the scene`, async () => {
      await upgrade(role, SCENE, `hex-${role}`);
      expect(calls).toEqual({ getUser: 0, sceneLookup: 1 });
    });

    test(`${role}: rate limited per IP`, async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 25; i++) statuses.push((await upgrade(role, SCENE, `burst-${role}`))!.status);
      expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
      expect(statuses.slice(20).every((s) => s === 429)).toBe(true);
      expect(calls.sceneLookup).toBe(20);
    });
  }
});

describe("monitor upgrades", () => {
  const signing = new Map<ServiceName, string>();
  const keys: ServiceJwk[] = [];

  beforeAll(async () => {
    for (const svc of ["web-admin", "rest-api"] as ServiceName[]) {
      const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
      const pub = await exportJWK(publicKey);
      const kid = await calculateJwkThumbprint(pub);
      signing.set(svc, JSON.stringify({ ...(await exportJWK(privateKey)), kid, alg: "EdDSA", svc }));
      keys.push({ ...pub, kid, alg: "EdDSA", svc });
    }
  });

  beforeEach(() => {
    serviceAuth = realServiceAuth.createServiceAuth({ jwks: { keys } });
  });

  async function token(svc: ServiceName, scope: ServiceScope) {
    process.env.WS_SERVICE_SIGNING_JWK = signing.get(svc)!;
    resetSigningKey();
    return signServiceToken(scope);
  }

  test("a web-admin monitor token in ?token= upgrades", async () => {
    const res = await upgrade("monitor", await token("web-admin", "monitor"), "monitor-ok");
    expect(res).toBeUndefined();
    expect(upgraded?.data).toMatchObject({ role: "monitor", userId: "_monitor", source: "web-admin" });
  });

  test("the token is also accepted in the Authorization header", async () => {
    const req = new Request("http://ws.local/ws?role=monitor", {
      headers: { authorization: `Bearer ${await token("web-admin", "monitor")}` },
    });
    expect(await handleUpgrade(req, server)).toBeUndefined();
    expect(upgraded?.data).toMatchObject({ role: "monitor" });
  });

  test("an expired token is refused", async () => {
    setSystemTime(new Date(Date.now() - 5 * 60_000));
    const old = await token("web-admin", "monitor");
    setSystemTime();
    expect((await upgrade("monitor", old, "monitor-expired"))?.status).toBe(401);
    expect(upgraded).toBeNull();
  });

  test("a web-admin token for another action is refused", async () => {
    expect((await upgrade("monitor", await token("web-admin", "broadcast"), "monitor-scope"))?.status).toBe(401);
    expect(upgraded).toBeNull();
  });

  test("a monitor token from a service without the monitor grant is refused", async () => {
    expect((await upgrade("monitor", await token("rest-api", "monitor"), "monitor-policy"))?.status).toBe(401);
    expect(upgraded).toBeNull();
  });

  test("garbage, a shared secret or no token is refused", async () => {
    for (const bad of ["not-a-token", JWT, "shared-monitor-secret"]) {
      expect((await upgrade("monitor", bad, "monitor-bad"))?.status).toBe(401);
    }
    const res = await handleUpgrade(new Request("http://ws.local/ws?role=monitor"), server);
    expect(res?.status).toBe(401);
    expect(upgraded).toBeNull();
  });

  test("without service keys the monitor is not configured", async () => {
    serviceAuth = realServiceAuth.createServiceAuth({});
    expect((await upgrade("monitor", await token("web-admin", "monitor"), "monitor-off"))?.status).toBe(404);
    expect(upgraded).toBeNull();
  });
});
