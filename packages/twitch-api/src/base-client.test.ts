import { describe, expect, mock, test } from "bun:test";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";

/* Token refresh failures, through a fake adapter so no request leaves the process. */

// Built from parts so Bun's source preview in an inspected stack can't contain them.
const CLIENT_SECRET = ["client", "secret", "must", "not", "leak"].join("-");
const REFRESH_TOKEN = ["refresh", "token", "must", "not", "leak"].join("-");
const USER_TOKEN = ["user", "token", "must", "not", "leak"].join("-");

process.env.TWITCH_CLIENT_ID = "test-client-id";
process.env.TWITCH_CLIENT_SECRET = CLIENT_SECRET;

mock.module("@repo/supabase/queries/twitch/tokens", () => ({
  getTwitchAppToken: async () => ({ access_token: "app", expires_in: 3600, updated_at: new Date().toISOString() }),
  getChannelAccessToken: async () => USER_TOKEN,
  getChannelRefreshToken: async () => REFRESH_TOKEN,
  updateChannelAccessToken: async () => {},
  updateTwitchAppToken: async () => {},
}));
mock.module("@repo/metrics", () => ({ trackTwitchApiRequest: () => {}, normalizeEndpoint: (url: string) => url }));
mock.module("./token-refresh-log", () => ({ logTokenRefreshFailure: async () => {} }));

const { TwitchApiBaseClient } = await import("./base-client");

class Probe extends TwitchApiBaseClient {
  user() {
    return this.clientApi().get("/videos", { params: { user_id: "123" } });
  }
}

/** Helix answers 401, then the token endpoint refuses the refresh. */
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const isRefresh = config.url?.startsWith("https://id.twitch.tv/");
  const status = isRefresh ? 400 : 401;
  const data = isRefresh
    ? { status: 400, message: "Invalid refresh token" }
    : { error: "Unauthorized", status: 401, message: "Invalid OAuth token" };
  const response = { status, statusText: "", headers: {}, config, data } as AxiosResponse;
  throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

describe("user token refresh failure", () => {
  test("logs what failed without the request's params or headers", async () => {
    axios.defaults.adapter = adapter;
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      lines.push(args.map((arg) => (typeof arg === "string" ? arg : Bun.inspect(arg))).join(" "));
    };
    try {
      const error = await new Probe("broadcaster-1").user().catch((e: unknown) => e);
      expect(axios.isAxiosError(error)).toBe(true);
    } finally {
      console.error = original;
    }

    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toBe(
      "[twitch-api] user token refresh failed: AxiosError: POST /oauth2/token -> 400 (Invalid refresh token)",
    );
    for (const line of lines) {
      expect(line).not.toContain(CLIENT_SECRET);
      expect(line).not.toContain(REFRESH_TOKEN);
      expect(line).not.toContain(USER_TOKEN);
    }
  });
});
