import { afterEach, describe, expect, test } from "bun:test";
import { publicTargets } from "./probes";

const VARS = [
  "STREAMWIZARD_API_URL",
  "WS_SERVER_URL",
  "NEXT_PUBLIC_WS_SERVER_URL",
  "OVERLAY_URL",
  "NEXT_PUBLIC_OVERLAY_URL",
  "DISCORD_BOT_HEALTH_URL",
  "OBS_AUTO_SWITCHER_HEALTH_URL",
  "STREAMWIZARD_BOT_HEALTH_URL",
] as const;
const before = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof VARS)[number], string>>) {
  for (const k of VARS) delete process.env[k];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const k of VARS) {
    if (before[k] === undefined) delete process.env[k];
    else process.env[k] = before[k];
  }
});

const ids = (env: "prod" | "staging" | "dev") => publicTargets(env).map((t) => t.id);

describe("publicTargets", () => {
  test("prod probes every web app on /api/health", () => {
    setEnv({});
    expect(publicTargets("prod")).toEqual([
      { id: "site", url: "https://streamwizard.org/api/health" },
      { id: "overlay", url: "https://overlay.streamwizard.org/api/health" },
      { id: "web-admin", url: "https://admin.streamwizard.org/api/health" },
    ]);
  });

  test("staging probes site and web-admin, and the overlay once its URL is set", () => {
    setEnv({});
    expect(ids("staging")).toEqual(["site", "web-admin"]);
    setEnv({ OVERLAY_URL: "https://overlay-staging.example.org/" });
    expect(publicTargets("staging")).toEqual([
      { id: "site", url: "https://staging.streamwizard.org/api/health" },
      { id: "overlay", url: "https://overlay-staging.example.org/api/health" },
      { id: "web-admin", url: "https://admin-staging.streamwizard.org/api/health" },
    ]);
  });

  test("the overlay URL falls back to the NEXT_PUBLIC_ name the web apps use", () => {
    setEnv({ NEXT_PUBLIC_OVERLAY_URL: "https://o.example.org" });
    expect(publicTargets("staging").find((t) => t.id === "overlay")?.url).toBe("https://o.example.org/api/health");
  });

  test("bots are probed in every env once their health URL is set", () => {
    setEnv({
      DISCORD_BOT_HEALTH_URL: "http://discord-bot:3000/health",
      OBS_AUTO_SWITCHER_HEALTH_URL: "http://obs-auto-switcher:8080/health",
      STREAMWIZARD_BOT_HEALTH_URL: "http://streamwizard-bot:3000/health",
    });
    for (const env of ["prod", "staging", "dev"] as const) {
      expect(ids(env)).toEqual(expect.arrayContaining(["discord-bot", "obs-auto-switcher", "streamwizard-bot"]));
    }
    expect(publicTargets("dev").find((t) => t.id === "obs-auto-switcher")?.url).toBe("http://obs-auto-switcher:8080/health");
  });

  test("an unset or empty bot URL is skipped, not probed", () => {
    setEnv({ DISCORD_BOT_HEALTH_URL: "" });
    expect(ids("dev")).toEqual([]);
  });

  test("rest-api and ws-server keep their existing targets", () => {
    setEnv({ STREAMWIZARD_API_URL: "https://api.example.org/", WS_SERVER_URL: "wss://ws.example.org/ws" });
    expect(publicTargets("dev")).toEqual([
      { id: "rest-api", url: "https://api.example.org/health" },
      { id: "ws-server", url: "https://ws.example.org/health" },
    ]);
  });
});
