import { beforeEach, describe, expect, mock, test } from "bun:test";

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
mock.module("@repo/supabase/queries/overlays", () => ({
  getOverlaySceneBySubscriberToken: () => {
    calls.sceneLookup++;
    return Promise.resolve({ data: null });
  },
  selectSceneOwnersByTokens: () => Promise.resolve({ data: [] }),
}));

const { handleUpgrade } = await import("./auth");

const server = { upgrade: () => true, requestIP: () => ({ address: "10.0.0.1" }) } as never;

function upgrade(role: string, token: string, ip: string) {
  const url = `http://ws.local/ws?role=${role}&token=${encodeURIComponent(token)}`;
  return handleUpgrade(new Request(url, { headers: { "cf-connecting-ip": ip } }), server);
}

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";
const SCENE = "a".repeat(64);

beforeEach(() => {
  calls.getUser = 0;
  calls.sceneLookup = 0;
});

describe("anonymous upgrades", () => {
  for (const role of ["publisher", "subscriber"]) {
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

  test("publisher and subscriber budgets are separate", async () => {
    for (let i = 0; i < 20; i++) await upgrade("subscriber", SCENE, "shared-ip");
    expect((await upgrade("publisher", SCENE, "shared-ip"))!.status).toBe(401);
  });
});
