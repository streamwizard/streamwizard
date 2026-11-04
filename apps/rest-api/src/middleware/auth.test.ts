import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

// supabaseAuth gates every /api/* route that acts for a signed-in user. The
// client is faked: what matters is which getUser() outcomes reach the route.

const reported: string[] = [];
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));

const { supabaseAuth } = await import("./auth");

type GetUser = () => Promise<{ data: { user: { id: string } | null }; error: { message: string; status?: number } | null }>;

let reached = 0;

function appWith(getUser: GetUser | null) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    if (getUser) c.set("supabase", { auth: { getUser } } as never);
    await next();
  });
  app.use("*", supabaseAuth());
  app.get("/me", (c) => {
    reached++;
    return c.json({ id: c.get("user")?.id });
  });
  return app;
}

beforeEach(() => {
  reached = 0;
  reported.length = 0;
});

describe("supabaseAuth", () => {
  test("a valid session reaches the route with its user", async () => {
    const res = await appWith(async () => ({ data: { user: { id: "user-1" } }, error: null })).request("/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "user-1" });
    expect(reached).toBe(1);
  });

  test("an auth error (bad or expired token) is a 401", async () => {
    const res = await appWith(async () => ({ data: { user: null }, error: { message: "invalid JWT", status: 401 } })).request("/me");
    expect(res.status).toBe(401);
    expect(reached).toBe(0);
  });

  test("no user and no error (no session at all) is a 401", async () => {
    const res = await appWith(async () => ({ data: { user: null }, error: null })).request("/me");
    expect(res.status).toBe(401);
    expect(reached).toBe(0);
  });

  test("a throwing client is a 500, reported, and never reaches the route", async () => {
    const res = await appWith(async () => {
      throw new Error("network down");
    }).request("/me");
    expect(res.status).toBe(500);
    expect(reached).toBe(0);
    expect(reported).toEqual(["auth.middleware"]);
  });

  test("without supabaseMiddleware in front it refuses instead of passing", async () => {
    const res = await appWith(null).request("/me");
    expect(res.status).toBe(500);
    expect(reached).toBe(0);
  });
});
