import { describe, expect, test } from "bun:test";
import { isTwitchClipId, parseClipVideoUrl } from "./clip-stream";

describe("isTwitchClipId", () => {
  test("accepts Twitch clip slugs", () => {
    expect(isTwitchClipId("AwkwardHelplessSalamanderSwiftRage-abc_123XYZ")).toBe(true);
  });

  test("rejects URLs and anything that is not a slug", () => {
    for (const value of [
      null,
      "",
      "http://169.254.169.254/latest/meta-data/",
      "https://evil.example/x.mp4",
      "../../etc/passwd",
      "clip id",
      "a".repeat(129),
    ]) {
      expect(isTwitchClipId(value)).toBe(false);
    }
  });
});

describe("parseClipVideoUrl", () => {
  test("accepts a plain https URL", () => {
    expect(parseClipVideoUrl("https://production.assets.clips.twitchcdn.net/v2/x.mp4?sig=1")?.hostname).toBe(
      "production.assets.clips.twitchcdn.net",
    );
  });

  test("rejects other schemes, credentials and explicit ports", () => {
    for (const value of [
      null,
      "not a url",
      "http://production.assets.clips.twitchcdn.net/x.mp4",
      "file:///etc/passwd",
      "https://user:pass@example.com/x.mp4",
      "https://example.com:8443/x.mp4",
    ]) {
      expect(parseClipVideoUrl(value)).toBeNull();
    }
  });
});
