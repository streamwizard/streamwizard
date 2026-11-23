import { describe, expect, it } from "bun:test";
import { envSchema } from "@/schemas/env";
import { newSessionSecret, newWireId, parseWireId } from "@/modules/live-sessions/credentials";
import { createLiveSessionSchema } from "@/modules/live-sessions/schemas";

describe("wire ids", () => {
  it("accepts 16 lowercase hex characters, refuses everything else", () => {
    expect(parseWireId("9f3c2a71e04b5d18")).toBe("9f3c2a71e04b5d18");
    for (const bad of [undefined, "", "0000000000000000", "9F3C2A71E04B5D18", "9f3c2a71e04b5d1", "9f3c2a71e04b5d180", "9f3c2a71e04b5d1g", " 9f3c2a71e04b5d1"]) {
      expect(parseWireId(bad)).toBeNull();
    }
  });

  it("new ids parse and differ", () => {
    const ids = new Set(Array.from({ length: 1000 }, newWireId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(parseWireId(id)).toBe(id);
  });

  it("new secrets are 32 bytes as unpadded base64url", () => {
    const secret = newSessionSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(secret, "base64url")).toHaveLength(32);
  });
});

describe("createLiveSessionSchema", () => {
  it("takes a 1..256 character stream key and strips other keys", () => {
    expect(createLiveSessionSchema.parse({ stream_key: "k", user_id: "someone-else" })).toEqual({ stream_key: "k" });
    expect(createLiveSessionSchema.safeParse({ stream_key: "x".repeat(256) }).success).toBe(true);
    for (const bad of [null, {}, { stream_key: "" }, { stream_key: "x".repeat(257) }, { stream_key: 1 }]) {
      expect(createLiveSessionSchema.safeParse(bad).success).toBe(false);
    }
  });
});

const base = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLIC_KEY: "public",
  SUPABASE_SECRET_KEY: "secret",
  TOKEN_ENCRYPTION_KEY: "key",
  TWITCH_CLIENT_ID: "id",
  TWITCH_CLIENT_SECRET: "secret",
  TWITCH_WEBHOOK_SECRET: "secret",
  STREAMWIZARD_API_URL: "http://localhost:8080",
  OBS_S3_ACCESS_KEY: "a",
  OBS_S3_BUCKET: "b",
  OBS_S3_ENDPOINT: "http://localhost:9000",
  OBS_S3_REGION: "r",
  OBS_S3_SECRET_KEY: "s",
  TAILSCALE_OAUTH_CLIENT_ID: "c",
  TAILSCALE_OAUTH_CLIENT_SECRET: "s",
};

describe("LIVE_INGEST_ENDPOINTS", () => {
  const parse = (value?: string) => envSchema.safeParse({ ...base, LIVE_INGEST_ENDPOINTS: value });

  it("unset or empty means no endpoints", () => {
    expect(parse(undefined).data?.LIVE_INGEST_ENDPOINTS).toEqual([]);
    expect(parse("").data?.LIVE_INGEST_ENDPOINTS).toEqual([]);
    expect(parse("[]").data?.LIVE_INGEST_ENDPOINTS).toEqual([]);
  });

  it("parses a JSON array of host and port", () => {
    expect(parse('[{"host":"192.168.1.20","port":7000},{"host":"ingest.example.test","port":7001}]').data?.LIVE_INGEST_ENDPOINTS).toEqual([
      { host: "192.168.1.20", port: 7000 },
      { host: "ingest.example.test", port: 7001 },
    ]);
  });

  it("a malformed value stops boot", () => {
    for (const bad of ["not json", '{"host":"a","port":1}', '[{"host":"","port":7000}]', '[{"host":"a","port":0}]', '[{"host":"a","port":70000}]', '[{"host":"a","port":"7000"}]']) {
      expect(parse(bad).success).toBe(false);
    }
  });
});

describe("LIVE_LATENCY_MS", () => {
  const parse = (value?: string) => envSchema.safeParse({ ...base, LIVE_LATENCY_MS: value });

  it("unset or empty means the 2000 ms default", () => {
    expect(parse(undefined).data?.LIVE_LATENCY_MS).toBe(2000);
    expect(parse("").data?.LIVE_LATENCY_MS).toBe(2000);
    expect(parse("  ").data?.LIVE_LATENCY_MS).toBe(2000);
  });

  it("takes whole milliseconds from 800 to 5000", () => {
    for (const [raw, ms] of [["800", 800], ["4000", 4000], ["5000", 5000], [" 1500 ", 1500]] as const) {
      expect(parse(raw).data?.LIVE_LATENCY_MS).toBe(ms);
    }
  });

  it("anything else stops boot, never clamped", () => {
    for (const bad of ["799", "5001", "0", "-1", "2000.5", "2e3", "2s", "abc", "100000"]) {
      expect(parse(bad).success).toBe(false);
    }
  });
});

describe("LIVE_SESSION_LIFETIME_S", () => {
  const parse = (value?: string) => envSchema.safeParse({ ...base, LIVE_SESSION_LIFETIME_S: value });

  it("unset or empty means the 86400 s (24 h) default", () => {
    expect(parse(undefined).data?.LIVE_SESSION_LIFETIME_S).toBe(86400);
    expect(parse("").data?.LIVE_SESSION_LIFETIME_S).toBe(86400);
    expect(parse("  ").data?.LIVE_SESSION_LIFETIME_S).toBe(86400);
  });

  it("takes whole seconds from 60 to 86400", () => {
    for (const [raw, seconds] of [["60", 60], ["3600", 3600], ["86400", 86400], [" 600 ", 600], ["00060", 60]] as const) {
      expect(parse(raw).data?.LIVE_SESSION_LIFETIME_S).toBe(seconds);
    }
  });

  it("anything else stops boot, never clamped", () => {
    for (const bad of ["59", "86401", "0", "-60", "600.5", "6e2", "10m", "abc", "100000", "999999"]) {
      expect(parse(bad).success).toBe(false);
    }
  });
});
