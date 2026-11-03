import { beforeEach, describe, expect, mock, test } from "bun:test";

const ACTOR = "aaaaaaaa-0000-4000-8000-000000000001";
const TARGET = "bbbbbbbb-0000-4000-8000-000000000002";

let calls: string[] = [];
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

mock.module("@/lib/assert-admin", () => ({ assertAdmin: async () => ACTOR }));
mock.module("@/lib/env", () => ({ env: {} }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
mock.module("@repo/sentry", () => ({ reportError: () => {} }));
mock.module("@/lib/ws-revoke", () => ({
  revokeWsSockets: async () => {
    calls.push("revoke-sockets");
  },
}));
mock.module("@repo/supabase/next/admin", () => ({
  createAdminClient: () => ({ from: () => userRoles }),
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
const realAdminUsers = await import("@repo/supabase/queries/admin-users");
mock.module("@repo/supabase/queries/admin-users", () => ({
  ...realAdminUsers,
  revokeUserSessions: async () => {
    calls.push("revoke-sessions");
    if (revokeFails) throw new Error("rpc failed");
    return 1;
  },
}));

const { removeUserTotpAction, setAdminRoleAction } = await import("./users");

beforeEach(() => {
  calls = [];
  revokeFails = false;
  roleRow = null;
});

describe("removeUserTotpAction", () => {
  test("ends every session before and after the factor is deleted", async () => {
    const res = await removeUserTotpAction(TARGET, "factor-1");
    expect(res.error).toBeNull();
    const factorAt = calls.indexOf("delete-factor");
    expect(calls.slice(0, factorAt)).toContain("revoke-sessions");
    expect(calls.slice(factorAt + 1)).toContain("revoke-sessions");
  });

  test("keeps the factor when sessions can't be ended", async () => {
    revokeFails = true;
    const res = await removeUserTotpAction(TARGET, "factor-1");
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
