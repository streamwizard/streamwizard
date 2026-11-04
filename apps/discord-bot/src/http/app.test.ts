import { describe, expect, test } from "bun:test";
import type { Client } from "discord.js";

// The routes import lib/env, which validates process.env at import time.
// Fill in the required keys before loading the app. NODE_ENV is set too:
// bun test presets it to "test", which the schema does not accept.
Object.assign(process.env, {
  NODE_ENV: "development",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "test",
  DISCORD_BOT_TOKEN: "test",
  DISCORD_CLIENT_ID: "test",
  NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
});
const { createInternalApp } = await import("./app");

const client = (ready: boolean) => ({ isReady: () => ready }) as unknown as Client;

describe("internal app /health", () => {
  test("answers 200 without a secret configured", async () => {
    const res = await createInternalApp(client(true), undefined).request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ready: true });
  });

  test("stays 200 while the gateway is not ready", async () => {
    const res = await createInternalApp(client(false), "s".repeat(16)).request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ready: false });
  });
});

describe("internal app dashboard API", () => {
  test("is not mounted without a secret", async () => {
    const res = await createInternalApp(client(true), undefined).request("/internal/guilds/1/cache");
    expect(res.status).toBe(404);
  });

  test("rejects a request without the bearer secret", async () => {
    const res = await createInternalApp(client(true), "s".repeat(16)).request("/internal/guilds/1/cache");
    expect(res.status).toBe(401);
  });
});

describe("ticket routes", () => {
  const SECRET = "s".repeat(16);
  let fetches = 0;
  const guild = {
    id: "100000000000000001",
    channels: {
      fetch: async () => {
        fetches++;
        return null;
      },
    },
  };
  const readyClient = { isReady: () => true, guilds: { cache: { get: () => guild } } } as unknown as Client;
  const post = (path: string, body: unknown) =>
    createInternalApp(readyClient, SECRET).request(`/internal/guilds/${guild.id}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  test("a channel id that isn't a snowflake is a 404 without a Discord call", async () => {
    fetches = 0;
    for (const path of ["/tickets/general/claim", "/tickets/123/close", "/tickets/abc/release", "/tickets/1%2F2/message"]) {
      const res = await post(path, { discordUserId: "200000000000000002", authorName: "a", authorAvatarUrl: null, content: "hi" });
      expect(res.status).toBe(404);
    }
    expect(fetches).toBe(0);
  });

  test("a snowflake channel id is looked up", async () => {
    fetches = 0;
    const res = await post("/tickets/300000000000000003/claim", { discordUserId: "200000000000000002" });
    expect(res.status).toBe(404);
    expect(fetches).toBe(1);
  });
});
