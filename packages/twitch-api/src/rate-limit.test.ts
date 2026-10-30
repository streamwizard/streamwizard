import { describe, expect, mock, test } from "bun:test";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";
import { RATE_LIMIT_MAX_WAIT_MS, rateLimitRetryDelay, warnRateLimited } from "./rate-limit";

const NOW = 1_800_000_000_000;
const reset = (msFromNow: number) => String((NOW + msFromNow) / 1000);

describe("rateLimitRetryDelay", () => {
  test("only a 429 from the general bucket (Ratelimit-Remaining: 0) is retried", () => {
    expect(rateLimitRetryDelay(500, { "ratelimit-remaining": "0" }, NOW)).toBeNull();
    expect(rateLimitRetryDelay(429, { "ratelimit-remaining": "12" }, NOW)).toBeNull();
    expect(rateLimitRetryDelay(429, {}, NOW)).toBeNull();
    expect(rateLimitRetryDelay(429, { "ratelimit-remaining": "0" }, NOW)).not.toBeNull();
  });

  test("waits until the reset, but never under 250ms or over a second", () => {
    const headers = (ms: number) => ({ "ratelimit-remaining": "0", "ratelimit-reset": reset(ms) });
    expect(rateLimitRetryDelay(429, headers(600), NOW)).toBe(600);
    expect(rateLimitRetryDelay(429, headers(45_000), NOW)).toBe(RATE_LIMIT_MAX_WAIT_MS);
    expect(rateLimitRetryDelay(429, headers(-5_000), NOW)).toBe(250);
  });
});

describe("warnRateLimited", () => {
  test("warns once a minute per bucket", () => {
    const warn = mock(() => {});
    const original = console.warn;
    console.warn = warn;
    try {
      warnRateLimited("test-a", "x", NOW);
      warnRateLimited("test-a", "x", NOW + 30_000);
      warnRateLimited("test-b", "x", NOW + 30_000);
      warnRateLimited("test-a", "x", NOW + 61_000);
    } finally {
      console.warn = original;
    }
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

/* The interceptor itself, through a fake adapter so no request leaves the process. */

mock.module("@repo/supabase", () => ({
  getTwitchAppToken: async () => ({ access_token: "app", expires_in: 3600, updated_at: new Date().toISOString() }),
  getChannelAccessToken: async () => "user",
  getChannelRefreshToken: async () => null,
  updateChannelAccessToken: async () => {},
  updateTwitchAppToken: async () => {},
}));
mock.module("@repo/metrics", () => ({ trackTwitchApiRequest: () => {}, normalizeEndpoint: (url: string) => url }));
mock.module("./token-refresh-log", () => ({ logTokenRefreshFailure: async () => {} }));

const { TwitchApiBaseClient } = await import("./base-client");

class Probe extends TwitchApiBaseClient {
  get() {
    return this.appApi().get("/users");
  }
}

function fakeHelix(statuses: Array<[number, Record<string, string>]>): { adapter: AxiosAdapter; calls: () => number } {
  let calls = 0;
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const [status, headers] = statuses[Math.min(calls++, statuses.length - 1)]!;
    const response = { status, statusText: "", headers, config, data: { data: [] } } as AxiosResponse;
    if (status >= 400) throw new AxiosError("Request failed", undefined, config, null, response);
    return response;
  };
  return { adapter, calls: () => calls };
}

describe("app interceptor on 429", () => {
  const dry = { "ratelimit-remaining": "0", "ratelimit-reset": String(Math.floor(Date.now() / 1000)) };

  test("retries once after a dry bucket and returns the retry's answer", async () => {
    const helix = fakeHelix([[429, dry], [200, { "ratelimit-remaining": "799" }]]);
    axios.defaults.adapter = helix.adapter;
    const original = console.warn;
    console.warn = () => {};
    try {
      const res = await new Probe().get();
      expect(res.status).toBe(200);
      expect(helix.calls()).toBe(2);
    } finally {
      console.warn = original;
    }
  });

  test("gives up after the one retry, with a message that names the rate limit", async () => {
    const helix = fakeHelix([[429, dry]]);
    axios.defaults.adapter = helix.adapter;
    const original = console.warn;
    console.warn = () => {};
    try {
      const error = await new Probe().get().catch((e: unknown) => e);
      expect(axios.isAxiosError(error)).toBe(true);
      expect((error as AxiosError).message).toContain("Twitch rate limit reached (GET /users)");
      expect(helix.calls()).toBe(2);
    } finally {
      console.warn = original;
    }
  });

  test("an endpoint-specific 429 (points still left) is not retried", async () => {
    const helix = fakeHelix([[429, { "ratelimit-remaining": "640" }]]);
    axios.defaults.adapter = helix.adapter;
    const original = console.warn;
    console.warn = () => {};
    try {
      await new Probe().get().catch(() => {});
      expect(helix.calls()).toBe(1);
    } finally {
      console.warn = original;
    }
  });
});
