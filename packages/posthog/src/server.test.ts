import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

interface Captured {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}

const captured: Captured[] = [];
let failCapture = false;

// The real client would open a connection per event; this one only records.
mock.module("posthog-node", () => ({
  PostHog: class {
    capture(message: Captured) {
      if (failCapture) throw new Error("capture failed");
      captured.push(message);
    }
    on() {}
    async shutdown() {}
  },
}));

process.env.POSTHOG_KEY = "phc_test";
const { configureTracking, trackServer } = await import("./server");

const ENV_KEYS = ["APP_ENV", "NODE_ENV", "POSTHOG_INTERNAL_USER_IDS", "POSTHOG_OPT_OUT_USER_IDS"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  captured.length = 0;
  failCapture = false;
  delete process.env.APP_ENV;
  delete process.env.POSTHOG_INTERNAL_USER_IDS;
  delete process.env.POSTHOG_OPT_OUT_USER_IDS;
  process.env.NODE_ENV = "staging";
  configureTracking({ app: "test-app" });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("trackServer", () => {
  it("sends the event under the account id, without a person profile", () => {
    trackServer("user-1", "discord_guild_joined", { linked: true });
    expect(captured).toEqual([
      {
        distinctId: "user-1",
        event: "discord_guild_joined",
        properties: { linked: true, app: "test-app", environment: "staging", $process_person_profile: false },
      },
    ]);
  });

  it("forwards the user agent and nothing else from the request", () => {
    const headers = new Headers({ "user-agent": "Mozilla/5.0 Test", "x-forwarded-for": "203.0.113.7" });
    trackServer("user-1", "discord_guild_joined", { linked: false }, { request: { headers } });
    expect(captured[0]?.properties.$raw_user_agent).toBe("Mozilla/5.0 Test");
    expect(JSON.stringify(captured[0])).not.toContain("203.0.113.7");
  });

  it("does not let a caller switch the person profile back on", () => {
    const sneaky = { linked: true, $process_person_profile: true, environment: "production" };
    trackServer("user-1", "discord_guild_joined", sneaky);
    expect(captured[0]?.properties.$process_person_profile).toBe(false);
    expect(captured[0]?.properties.environment).toBe("staging");
  });

  it("flags accounts on the internal id list", () => {
    process.env.POSTHOG_INTERNAL_USER_IDS = "user-9, user-1";
    trackServer("user-1", "discord_guild_joined", { linked: true });
    trackServer("user-2", "discord_guild_joined", { linked: true });
    expect(captured[0]?.properties.internal_user).toBe(true);
    expect(captured[1]?.properties).not.toHaveProperty("internal_user");
  });

  it("flags an account the caller marks as internal", () => {
    trackServer("user-2", "discord_guild_joined", { linked: true }, { internal: true });
    expect(captured[0]?.properties.internal_user).toBe(true);
  });

  it("marks an event the browser reported", () => {
    trackServer("user-1", "discord_guild_joined", { linked: true }, { relayed: true });
    trackServer("user-1", "discord_guild_joined", { linked: true });
    expect(captured[0]?.properties.relayed).toBe(true);
    expect(captured[1]?.properties).not.toHaveProperty("relayed");
  });

  it("sends nothing for an account that objected", () => {
    process.env.POSTHOG_OPT_OUT_USER_IDS = "user-1";
    trackServer("user-1", "discord_guild_joined", { linked: true });
    trackServer("user-2", "discord_guild_joined", { linked: true });
    expect(captured.map((event) => event.distinctId)).toEqual(["user-2"]);
  });

  it("sends nothing in development or when the environment is unknown", () => {
    process.env.NODE_ENV = "development";
    trackServer("user-1", "discord_guild_joined", { linked: true });
    delete process.env.NODE_ENV;
    trackServer("user-1", "discord_guild_joined", { linked: true });
    expect(captured).toHaveLength(0);
  });

  it("reads the environment from APP_ENV first, as the Next apps set it", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "development";
    trackServer("user-1", "discord_guild_joined", { linked: true });
    expect(captured).toHaveLength(0);
  });

  it("reports a failed capture instead of throwing", () => {
    const errors: unknown[] = [];
    configureTracking({ app: "test-app", onError: (error) => errors.push(error) });
    failCapture = true;
    expect(() => trackServer("user-1", "discord_guild_joined", { linked: true })).not.toThrow();
    expect(errors).toHaveLength(1);
  });
});
