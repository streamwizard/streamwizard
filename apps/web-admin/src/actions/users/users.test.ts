import { beforeEach, describe, expect, mock, test } from "bun:test";

const ACTOR = "aaaaaaaa-0000-4000-8000-000000000001";
const TARGET = "bbbbbbbb-0000-4000-8000-000000000002";
const FACTOR = "cccccccc-0000-4000-8000-000000000003";

let calls: string[] = [];
let dbCalls = 0;
let revokeFails = false;
let roleRow: { id: string } | null = null;

const userRoles = {
  select: () => userRoles,
  eq: () => userRoles,
  maybeSingle: async () => ({ data: roleRow, error: null }),
  insert: () => {
    calls.push("insert-role");
    return { select: () => ({ single: async () => ({ data: { id: "role-1" }, error: null }) }) };
  },
  delete: () => ({
    eq: async () => {
      calls.push("delete-role");
      return { error: null };
    },
  }),
};

// Spread the real exports: bun shares module mocks across test files.
const realAssertAdmin = await import("@/lib/auth/assert-admin");
mock.module("@/lib/auth/assert-admin", () => ({ ...realAssertAdmin, assertAdmin: async () => ACTOR }));
mock.module("@/lib/env", () => ({ env: {} }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
const realSentry = await import("@repo/sentry");
mock.module("@repo/sentry", () => ({ ...realSentry, reportError: () => {} }));
mock.module("@/lib/ws-revoke", () => ({
  revokeWsSockets: async () => {
    calls.push("revoke-sockets");
  },
}));
const realAdmin = await import("@repo/supabase/next/admin");
mock.module("@repo/supabase/next/admin", () => ({
  ...realAdmin,
  createAdminClient: () => ({
    from: () => {
      dbCalls++;
      return userRoles;
    },
  }),
  supabaseAdmin: {
    auth: {
      admin: {
        mfa: {
          deleteFactor: async () => {
            calls.push("delete-factor");
            return { error: null };
          },
        },
      },
    },
  },
}));
const realAdminUsers = await import("@repo/supabase/queries/users/admin-users");
mock.module("@repo/supabase/queries/users/admin-users", () => ({
  ...realAdminUsers,
  revokeUserSessions: async () => {
    calls.push("revoke-sessions");
    if (revokeFails) throw new Error("rpc failed");
    return 1;
  },
}));

const { banUserAction, deleteUserAction, removeUserTotpAction, resyncEventSubAction, setAdminRoleAction, unlinkDiscordAction } =
  await import("./users");

beforeEach(() => {
  calls = [];
  dbCalls = 0;
  revokeFails = false;
  roleRow = null;
});

describe("removeUserTotpAction", () => {
  test("ends every session before and after the factor is deleted", async () => {
    const res = await removeUserTotpAction(TARGET, FACTOR);
    expect(res.error).toBeNull();
    const factorAt = calls.indexOf("delete-factor");
    expect(calls.slice(0, factorAt)).toContain("revoke-sessions");
    expect(calls.slice(factorAt + 1)).toContain("revoke-sessions");
  });

  test("keeps the factor when sessions can't be ended", async () => {
    revokeFails = true;
    const res = await removeUserTotpAction(TARGET, FACTOR);
    expect(res.error).not.toBeNull();
    expect(calls).not.toContain("delete-factor");
  });
});

describe("setAdminRoleAction", () => {
  test("ends the grantee's sessions when the role is granted", async () => {
    const res = await setAdminRoleAction(TARGET, true);
    expect(res.error).toBeNull();
    expect(calls).toEqual(["insert-role", "revoke-sockets", "revoke-sessions"]);
  });

  test("takes the role back when sessions can't be ended", async () => {
    revokeFails = true;
    const res = await setAdminRoleAction(TARGET, true);
    expect(res.error).not.toBeNull();
    expect(calls).toContain("delete-role");
  });
});

describe("bad input", () => {
  // Server actions are public POST endpoints: junk arguments are refused
  // before any database read, session revoke or Twitch/Discord call.
  test("a user id that isn't an id is refused without touching anything", async () => {
    const results = await Promise.all([
      setAdminRoleAction("../../etc", true),
      unlinkDiscordAction("not-an-id"),
      resyncEventSubAction("1 or 1=1"),
      removeUserTotpAction(TARGET, "factor-1"),
    ]);
    for (const res of results) expect(res.error).toBeString();
    expect(calls).toEqual([]);
    expect(dbCalls).toBe(0);
  });

  test("a wrong-typed flag or an overlong reason is refused", async () => {
    const ban = await banUserAction(TARGET, { reason: "x".repeat(5000), banDiscord: false, stopEventSub: false });
    const del = await deleteUserAction(TARGET, { confirmation: "name", banDiscord: "yes" as unknown as boolean });
    expect(ban).toEqual({ error: expect.any(String), warnings: [] });
    expect(del).toEqual({ error: expect.any(String), warnings: [] });
    expect(calls).toEqual([]);
    expect(dbCalls).toBe(0);
  });
});
