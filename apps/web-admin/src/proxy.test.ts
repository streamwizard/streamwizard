import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest, NextResponse } from "next/server";

let claims: Record<string, unknown> | null = null;
let admin = false;

mock.module("@repo/supabase/next/proxy", () => ({
  refreshSession: async () => ({ response: NextResponse.next(), claims }),
}));
mock.module("@repo/supabase/next/admin", () => ({ supabaseAdmin: {} }));
mock.module("@repo/supabase/queries/obs-nodes", () => ({ isUserAdmin: async () => admin }));

const { proxy, config } = await import("./proxy");
// Next's own matcher compiler, so the test sees exactly what the build does.
// Exported at runtime but missing from Next's type declarations.
const { getMiddlewareMatchers } = (await import("next/dist/build/analysis/get-page-static-info")) as unknown as {
  getMiddlewareMatchers: (matcher: unknown, config: { i18n: undefined; basePath: string }) => { regexp: string }[];
};

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

  test("the matcher runs the proxy on every page, file-like paths included (SW-485)", () => {
    const [matcher] = getMiddlewareMatchers(config.matcher, { i18n: undefined, basePath: "" });
    expect(matcher).toBeDefined();
    const runsProxy = (path: string) => new RegExp(matcher!.regexp).test(path);
    // Dynamic routes accept these; skipping them skipped the admin gate.
    for (const path of ["/discord/tickets/12.css", "/discord/tickets/12.html", "/users/abc.png", "/vms/pve1.ico/101", "/overview", "/login"]) {
      expect(runsProxy(path)).toBe(true);
    }
    for (const path of ["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/icon.png", "/apple-icon.png"]) {
      expect(runsProxy(path)).toBe(false);
    }
  });
});
