import { beforeAll, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("./utils", () => ({ logSecurityEvent: async () => {} }));

let app: Hono;

beforeAll(async () => {
  const { bruteForceProtection } = await import("./brute-force");
  app = new Hono();
  app.use("*", bruteForceProtection({ maxAttempts: 3 }));
  app.all("/api/private", (c) => c.json({ error: "Unauthorized" }, 401));
  app.all("/api/public", (c) => c.json({ ok: true }));
  app.post("/webhooks/twitch/eventsub", (c) => c.body(null, 401));
  app.post("/api/nodes/claim", (c) => c.body(null, 401));
});

async function hit(path: string, headers: Record<string, string>, method = "GET") {
  const res = await app.request(path, { method, headers });
  return res.status;
}

async function failThreeTimes(headers: Record<string, string>) {
  for (let i = 0; i < 3; i++) expect(await hit("/api/private", headers)).toBe(401);
}

describe("bruteForceProtection (SW-482)", () => {
  it("locks out the Cloudflare client IP, not other clients", async () => {
    await failThreeTimes({ "cf-connecting-ip": "198.51.100.1" });
    expect(await hit("/api/public", { "cf-connecting-ip": "198.51.100.1" })).toBe(429);
    expect(await hit("/api/public", { "cf-connecting-ip": "198.51.100.2" })).toBe(200);
  });

  it("ignores X-Forwarded-For and X-Real-IP, so a caller can't lock out someone else", async () => {
    const victim = "203.0.113.7";
    await failThreeTimes({ "cf-connecting-ip": "198.51.100.3", "x-forwarded-for": victim, "x-real-ip": victim });
    expect(await hit("/api/public", { "cf-connecting-ip": victim })).toBe(200);
  });

  it("never locks out webhook or node routes, and their 401s don't count", async () => {
    const twitch = { "cf-connecting-ip": "198.51.100.4" };
    for (let i = 0; i < 5; i++) {
      expect(await hit("/webhooks/twitch/eventsub", twitch, "POST")).toBe(401);
      expect(await hit("/api/nodes/claim", twitch, "POST")).toBe(401);
    }
    expect(await hit("/api/public", twitch)).toBe(200);
  });
});
