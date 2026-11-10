import { describe, expect, test } from "bun:test";
import { isGuid, isSnowflake, isTwitchClipId, isUuid, twitchClipIdSchema } from "./ids";

describe("ids", () => {
  test("isGuid accepts any 8-4-4-4-12 hex id, including seed-style ids", () => {
    expect(isGuid("aaaaaaaa-0000-0000-0000-000000000001")).toBe(true);
    expect(isGuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
    expect(isGuid("not-a-uuid")).toBe(false);
    expect(isGuid("aaaaaaaa-0000-0000-0000-0000000000011")).toBe(false);
    expect(isGuid(undefined)).toBe(false);
  });

  test("isUuid only accepts RFC UUIDs", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("aaaaaaaa-0000-0000-0000-000000000001")).toBe(false);
  });

  test("isSnowflake accepts 17-20 digit Discord ids only", () => {
    expect(isSnowflake("123456789012345678")).toBe(true);
    expect(isSnowflake("1234")).toBe(false);
    expect(isSnowflake("12345678901234567x")).toBe(false);
    expect(isSnowflake(null)).toBe(false);
  });

  test("isTwitchClipId accepts Twitch clip slugs", () => {
    expect(isTwitchClipId("AwkwardHelplessSalamanderSwiftRage-abc_123XYZ")).toBe(true);
    expect(twitchClipIdSchema.safeParse("AwkwardHelplessSalamander-abc_1").success).toBe(true);
  });

  test("isTwitchClipId rejects URLs and anything that is not a slug", () => {
    for (const value of [
      null,
      42,
      "",
      "http://169.254.169.254/latest/meta-data/",
      "https://evil.example/x.mp4",
      "../../etc/passwd",
      "clip id",
      "a".repeat(129),
    ]) {
      expect(isTwitchClipId(value)).toBe(false);
      expect(twitchClipIdSchema.safeParse(value).success).toBe(false);
    }
  });
});
