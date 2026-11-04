import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("@/middleware/security/utils", () => ({ logSecurityEvent: async () => {} }));

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 60 * 60 * 1000;

let bruteForceProtection: typeof import("./brute-force").bruteForceProtection;
let app: Hono;
let clock: number;

beforeAll(async () => {
  ({ bruteForceProtection } = await import("@/middleware/security/brute-force"));
});

beforeEach(() => {
  clock = 1_000_000;
  app = new Hono();
  app.use("*", bruteForceProtection({ maxAttempts: 3, windowMs: WINDOW_MS, blockDurationMs: BLOCK_MS, now: () => clock }));
  app.get("/", (c) => c.json({ message: "StreamWizard API" }));
  app.all("/api/private", (c) => c.json({ error: "Unauthorized" }, 401));
  app.all("/api/public", (c) => c.json({ ok: true }));
  // Same contract as supabaseAuth(): 401 on a bad credential, `user` set on a good one.
  app.get("/api/session", (c) => {
    if (c.req.header("authorization") !== "Bearer valid") return c.json({ error: "Unauthorized" }, 401);
    c.set("user", { id: "user-1" });
    return c.json({ ok: true });
  });
  app.post("/webhooks/twitch/eventsub", (c) => c.body(null, 401));
  app.post("/api/obs-nodes/claim", (c) => c.body(null, 401));
  app.post("/api/ingest-nodes/claim", (c) => c.body(null, 401));
});

async function hit(path: string, headers: Record<string, string>, method = "GET") {
  const res = await app.request(path, { method, headers });
  return res.status;
}

async function fail(headers: Record<string, string>, times: number) {
  for (let i = 0; i < times; i++) expect(await hit("/api/private", headers)).toBe(401);
}

describe("bruteForceProtection (SW-482)", () => {
  it("locks out the Cloudflare client IP, not other clients", async () => {
    await fail({ "cf-connecting-ip": "198.51.100.1" }, 3);
    expect(await hit("/api/public", { "cf-connecting-ip": "198.51.100.1" })).toBe(429);
    expect(await hit("/api/public", { "cf-connecting-ip": "198.51.100.2" })).toBe(200);
  });

  it("ignores X-Forwarded-For and X-Real-IP, so a caller can't lock out someone else", async () => {
    const victim = "203.0.113.7";
    await fail({ "cf-connecting-ip": "198.51.100.3", "x-forwarded-for": victim, "x-real-ip": victim }, 3);
    expect(await hit("/api/public", { "cf-connecting-ip": victim })).toBe(200);
  });

  it("never locks out webhook or node routes, and their 401s don't count", async () => {
    const twitch = { "cf-connecting-ip": "198.51.100.4" };
    for (let i = 0; i < 5; i++) {
      expect(await hit("/webhooks/twitch/eventsub", twitch, "POST")).toBe(401);
      expect(await hit("/api/obs-nodes/claim", twitch, "POST")).toBe(401);
      expect(await hit("/api/ingest-nodes/claim", twitch, "POST")).toBe(401);
    }
    expect(await hit("/api/public", twitch)).toBe(200);
  });
});

describe("bruteForceProtection block and window (SW-503)", () => {
  const ip = { "cf-connecting-ip": "198.51.100.10" };

  it("keeps the block for the full block duration, past the end of the window", async () => {
    await fail(ip, 3);

    clock += WINDOW_MS + 1;
    expect(await hit("/api/public", ip)).toBe(429);

    clock += BLOCK_MS - WINDOW_MS - 2; // 1 ms before the block ends
    expect(await hit("/api/public", ip)).toBe(429);

    clock += 1;
    expect(await hit("/api/public", ip)).toBe(200);
  });

  it("starts a fresh count once the block ends", async () => {
    await fail(ip, 3);
    clock += BLOCK_MS;
    await fail(ip, 2);
    expect(await hit("/api/public", ip)).toBe(200);
    await fail(ip, 1);
    expect(await hit("/api/public", ip)).toBe(429);
  });

  it("sends Retry-After with the time left on the block", async () => {
    await fail(ip, 3);
    clock += 30 * 60 * 1000;
    const res = await app.request("/api/public", { headers: ip });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe(String(30 * 60));
  });

  it("does not reset the count on a 200 from an unauthenticated route", async () => {
    await fail(ip, 2);
    expect(await hit("/", ip)).toBe(200);
    expect(await hit("/api/public", ip)).toBe(200);
    await fail(ip, 1);
    expect(await hit("/api/public", ip)).toBe(429);
  });

  it("resets the count after a successful authentication", async () => {
    await fail(ip, 2);
    expect(await hit("/api/session", { ...ip, authorization: "Bearer valid" })).toBe(200);
    await fail(ip, 2);
    expect(await hit("/api/public", ip)).toBe(200);
  });

  it("counts a bad credential on the authenticated route", async () => {
    for (let i = 0; i < 3; i++) expect(await hit("/api/session", { ...ip, authorization: "Bearer wrong" })).toBe(401);
    expect(await hit("/api/session", { ...ip, authorization: "Bearer valid" })).toBe(429);
  });

  it("forgets failures once the window passes without a block", async () => {
    await fail(ip, 2);
    clock += WINDOW_MS;
    await fail(ip, 2);
    expect(await hit("/api/public", ip)).toBe(200);
  });

  it("keeps the window fixed from the first failure", async () => {
    await fail(ip, 1);
    clock += WINDOW_MS - 1;
    await fail(ip, 2);
    expect(await hit("/api/public", ip)).toBe(429);
  });
});
