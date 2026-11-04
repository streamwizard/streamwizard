import { describe, expect, test } from "bun:test";
import { parseClipVideoUrl } from "@/lib/clips/clip-stream";

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
