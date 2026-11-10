import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

// getAdminSession gates every web-admin layout and, through assertAdmin, every
// server action: the admin role plus a TOTP-verified (aal2) session. Each
// refused state has its own redirect.

type Factor = { id: string; factor_type: string; status: string };

let claims: Record<string, unknown> | null;
let claimsError: { name: string; message: string } | null;
let user: { id: string; email?: string; factors?: Factor[] } | null;
let admins: Set<string>;
let adminLookups: string[];

mock.module("@repo/supabase/next/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: claims ? { claims } : null, error: claimsError }),
      getUser: async () => ({ data: { user }, error: user ? null : { name: "AuthSessionMissingError", message: "Auth session missing!" } }),
    },
  }),
}));
mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
const realRoleQueries = await import("@repo/supabase/queries/auth/roles");
mock.module("@repo/supabase/queries/auth/roles", () => ({
  ...realRoleQueries,
  isUserAdmin: async (_client: unknown, userId: string) => {
    adminLookups.push(userId);
    return admins.has(userId);
  },
}));

const { getAdminSession } = await import("@/lib/auth/admin-session");
// Other test files mock "@/lib/assert-admin" for the whole run (bun shares
// module mocks across files); the query string loads this file's real module.
const realAssertAdminSpecifier = "./assert-admin?real";
const { assertAdmin } = (await import(realAssertAdminSpecifier)) as typeof import("@/lib/auth/assert-admin");

const TOTP: Factor = { id: "f1", factor_type: "totp", status: "verified" };

// The gate logs real auth errors. Stubbed so the test output stays clean and
// so Next's console patching (loaded by other test files) is never hit.
let warn: ReturnType<typeof spyOn>;

afterEach(() => {
  warn.mockRestore();
});

beforeEach(() => {
  warn = spyOn(console, "warn").mockImplementation(() => {});
  claims = { sub: "admin-1", aal: "aal2" };
  claimsError = null;
  user = { id: "admin-1", email: "admin@test.local", factors: [TOTP] };
  admins = new Set(["admin-1"]);
  adminLookups = [];
});

describe("getAdminSession", () => {
  test("an admin with a TOTP-verified session gets a session", async () => {
    const result = await getAdminSession();
    expect(result.redirect).toBeNull();
    expect(result.session).toMatchObject({ userId: "admin-1", email: "admin@test.local", strong: true });
    expect(await assertAdmin()).toBe("admin-1");
  });

  test("signed out goes to the login page", async () => {
    claims = null;
    user = null;
    expect(await getAdminSession()).toEqual({ session: null, redirect: "/login?error=signin_required" });
    expect(adminLookups).toEqual([]);
    await expect(assertAdmin()).rejects.toThrow("Not signed in");
    expect(warn).not.toHaveBeenCalled();
  });

  test("a claims error goes to the login page", async () => {
    claims = null;
    claimsError = { name: "AuthApiError", message: "invalid JWT" };
    expect((await getAdminSession()).redirect).toBe("/login?error=signin_required");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("claims without a user (revoked session) go to the login page", async () => {
    user = null;
    expect((await getAdminSession()).redirect).toBe("/login?error=signin_required");
    expect(adminLookups).toEqual([]);
  });

  test("a signed-in user without the admin role gets no access, even at aal2", async () => {
    claims = { sub: "user-2", aal: "aal2" };
    user = { id: "user-2", factors: [TOTP] };
    expect(await getAdminSession()).toEqual({ session: null, redirect: "/no-access" });
    await expect(assertAdmin()).rejects.toThrow("Not authorized");
  });

  test("the admin lookup uses the user from getUser, not the claims", async () => {
    claims = { sub: "admin-1", aal: "aal2" };
    user = { id: "user-2", factors: [TOTP] };
    expect((await getAdminSession()).redirect).toBe("/no-access");
    expect(adminLookups).toEqual(["user-2"]);
  });

  test("an admin at aal1 with a TOTP factor is sent to verify it", async () => {
    claims = { sub: "admin-1", aal: "aal1" };
    expect(await getAdminSession()).toEqual({ session: null, redirect: "/auth/verify" });
    await expect(assertAdmin()).rejects.toThrow("Verification required");
  });

  test("an admin at aal1 without a TOTP factor is sent to set one up", async () => {
    claims = { sub: "admin-1", aal: "aal1" };
    user = { id: "admin-1", factors: [] };
    expect(await getAdminSession()).toEqual({ session: null, redirect: "/auth/setup" });
  });

  test("an unverified TOTP factor does not count as having one", async () => {
    claims = { sub: "admin-1", aal: "aal1" };
    user = { id: "admin-1", factors: [{ id: "f2", factor_type: "totp", status: "unverified" }] };
    expect((await getAdminSession()).redirect).toBe("/auth/setup");
  });

  test("a passkey sign-in at aal1 is not a strong session (SW-483)", async () => {
    claims = { sub: "admin-1", aal: "aal1", amr: [{ method: "passkey", timestamp: 1 }] };
    expect((await getAdminSession()).redirect).toBe("/auth/verify");
  });

  test("claims without an aal are not a strong session", async () => {
    claims = { sub: "admin-1" };
    expect((await getAdminSession()).redirect).toBe("/auth/verify");
  });
});
