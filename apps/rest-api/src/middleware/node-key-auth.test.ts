import { describe, expect, it } from "bun:test";
import { createHash } from "crypto";
import { Hono } from "hono";
import { TtlCache } from "@repo/ttl-cache";
import { createNodeKeyAuth } from "@/middleware/node-key-auth";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function setup(known: Record<string, string>) {
  const seen: string[] = [];
  const cache = new TtlCache<string>({ ttlMs: 60_000, negativeTtlMs: 5_000 });
  const auth = createNodeKeyAuth({
    cache,
    lookup: async (keyHash) => {
      seen.push(keyHash);
      return known[keyHash] ?? null;
    },
    varName: "nodeId",
  });
  const app = new Hono();
  app.get("/me", auth(), (c) => c.json({ nodeId: c.get("nodeId") }));
  const call = (authorization?: string) =>
    app.request("/me", authorization === undefined ? undefined : { headers: { Authorization: authorization } });
  return { call, seen, cache };
}

describe("createNodeKeyAuth", () => {
  it("refuses a missing header", async () => {
    const { call, seen } = setup({});
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authorization header is required" });
    expect(seen).toEqual([]);
  });

  it("refuses another scheme", async () => {
    const { call, seen } = setup({});
    const res = await call("Basic abc");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authorization header must use Bearer scheme" });
    expect(seen).toEqual([]);
  });

  it("refuses a blank token", async () => {
    const { call, seen } = setup({});
    // Headers strip trailing whitespace, so "Bearer   " arrives as "Bearer"
    // and fails the scheme check before the empty-token check.
    for (const header of ["Bearer ", "Bearer    "]) {
      const res = await call(header);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Authorization header must use Bearer scheme" });
    }
    expect(seen).toEqual([]);
  });

  it("refuses an unknown key and caches the miss", async () => {
    const { call, seen } = setup({});
    for (let i = 0; i < 3; i++) {
      const res = await call("Bearer unknown");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: "Node API key not recognised — re-run the claim step or contact an admin",
      });
    }
    expect(seen).toEqual([hash("unknown")]);
  });

  it("looks the key up by its SHA-256 hash, trimmed, and sets the context variable", async () => {
    const { call, seen, cache } = setup({ [hash("good-key")]: "node-1" });
    const res = await call("Bearer  good-key ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nodeId: "node-1" });
    expect(seen).toEqual([hash("good-key")]);

    expect((await call("Bearer good-key")).status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(cache.stats().hits).toBe(1);
  });
});
