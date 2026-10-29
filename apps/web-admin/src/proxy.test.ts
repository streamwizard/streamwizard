import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest, NextResponse } from "next/server";

let claims: Record<string, unknown> | null = null;
let admin = false;

mock.module("@repo/supabase/next/proxy", () => ({
  refreshSession: async () => ({ response: NextResponse.next(), claims }),
}));
mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
mock.module("@repo/supabase/queries/obs-nodes", () => ({ isUserAdmin: async () => admin }));

const { proxy } = await import("./proxy");

async function hit(path: string, headers: Record<string, string> = {}) {
  const res = await proxy(new NextRequest(`https://admin.test${path}`, { headers }));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("web-admin proxy gate", () => {
  beforeEach(() => {
    claims = null;
    admin = false;
  });

  test("anonymous page and RSC requests are redirected before render", async () => {
    expect(await hit("/users")).toBe("/login");
    expect(await hit("/users?_rsc=abc", { RSC: "1", "Next-Router-State-Tree": "%5B%5D" })).toBe("/login");
    expect(await hit("/")).toBe("/login");
  });

  test("non-admins go to /no-access", async () => {
    claims = { sub: "u1", aal: "aal2" };
    expect(await hit("/overview")).toBe("/no-access");
  });

  test("single-factor admins must verify", async () => {
    claims = { sub: "u1", aal: "aal1", amr: [{ method: "oauth" }] };
    admin = true;
    expect(await hit("/overview")).toBe("/auth/verify");
  });

  test("strong admin sessions pass", async () => {
    claims = { sub: "u1", aal: "aal2" };
    admin = true;
    expect(await hit("/overview")).toBeNull();
  });

  test("passkey sign-in no longer counts as a second factor (SW-483)", async () => {
    claims = { sub: "u1", aal: "aal1", amr: [{ method: "passkey" }] };
    admin = true;
    expect(await hit("/users")).toBe("/auth/verify");
  });

  test("auth, login and api paths stay reachable", async () => {
    for (const path of ["/login", "/auth/verify", "/auth/setup", "/auth/callback", "/no-access", "/api/health", "/monitoring"]) {
      expect(await hit(path)).toBeNull();
    }
    expect(await hit("/loginx")).toBe("/login");
  });
});
