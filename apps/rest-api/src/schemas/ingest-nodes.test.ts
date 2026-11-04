import { describe, expect, test } from "bun:test";
import { claimIngestNodeSchema, patchIngestNodeMeSchema } from "./ingest-nodes";
import { parseUuid } from "./nodes-shared";

describe("ingest node bodies", () => {
  // What ingest-server's install.sh sends.
  const claim = { token: "t", cpu_cores: 4, ram_total_mb: 8000, storage_total_mb: 100000, public_ip: "203.0.113.4", lan_ip: "10.0.0.5", tailscale_ip: null };

  test("claim passes with IPv4, IPv6 or null addresses; unknown keys are stripped", () => {
    expect(claimIngestNodeSchema.parse({ ...claim, node_id: "x" })).toEqual(claim);
    expect(claimIngestNodeSchema.parse({ ...claim, public_ip: "2001:db8::1" }).public_ip).toBe("2001:db8::1");
    expect(claimIngestNodeSchema.parse({ token: "t" })).toEqual({ token: "t" });
  });

  test("a junk address becomes null instead of failing the claim", () => {
    expect(claimIngestNodeSchema.parse({ ...claim, public_ip: "<html>", lan_ip: 7 })).toMatchObject({ public_ip: null, lan_ip: null });
  });

  test("claim refuses a missing token and non-integer counts", () => {
    expect(claimIngestNodeSchema.safeParse({ ...claim, token: undefined }).success).toBe(false);
    expect(claimIngestNodeSchema.safeParse({ ...claim, cpu_cores: 2.5 }).success).toBe(false);
    expect(claimIngestNodeSchema.safeParse({ ...claim, ram_total_mb: -1 }).success).toBe(false);
  });

  test("PATCH /me needs an IPv4 address", () => {
    expect(patchIngestNodeMeSchema.safeParse({ tailscale_ip: "100.64.0.9" }).success).toBe(true);
    expect(patchIngestNodeMeSchema.safeParse({ tailscale_ip: "" }).success).toBe(false);
    expect(patchIngestNodeMeSchema.safeParse({}).success).toBe(false);
  });
});

describe("parseUuid", () => {
  test("only UUIDs come back", () => {
    expect(parseUuid("0e0e0000-0000-4000-8000-000000000001")).toBe("0e0e0000-0000-4000-8000-000000000001");
    for (const bad of [undefined, "", "vram", "0e0e0000-0000-4000-8000-00000000000g", "1' or '1'='1"]) {
      expect(parseUuid(bad)).toBeNull();
    }
  });
});
