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

describe("LIVE_INGEST_ENDPOINTS", () => {
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
