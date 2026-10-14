import { describe, expect, it } from "bun:test";
import { parseSocialLinks } from "./authors";

describe("parseSocialLinks", () => {
  it("keeps valid links and drops blank ones", () => {
    expect(
      parseSocialLinks({
        twitch: " https://www.twitch.tv/xpudu ",
        x: "",
        bluesky: "https://bsky.app/profile/sw.bsky.social",
        website: "https://streamwizard.org",
      }),
    ).toEqual({
      links: {
        twitch: "https://www.twitch.tv/xpudu",
        bluesky: "https://bsky.app/profile/sw.bsky.social",
        website: "https://streamwizard.org/",
      },
      error: null,
    });
  });

  it("needs https", () => {
    expect(parseSocialLinks({ website: "http://example.com" }).error).toBe(
      "The Website link has to start with https://.",
    );
    expect(parseSocialLinks({ twitch: "twitch.tv/xpudu" }).error).toContain("isn't a full URL");
  });

  it("checks the platform's domain", () => {
    expect(parseSocialLinks({ youtube: "https://youtu.be/abc" }).error).toBeNull();
    expect(parseSocialLinks({ x: "https://twitter.com/sw" }).error).toBeNull();
    expect(parseSocialLinks({ twitch: "https://evil.example/twitch.tv" }).error).toBe("That isn't a Twitch link.");
    expect(parseSocialLinks({ twitch: "https://nottwitch.tv/x" }).error).toBe("That isn't a Twitch link.");
  });

  it("refuses script links", () => {
    expect(parseSocialLinks({ website: "javascript:alert(1)" }).error).toBe(
      "The Website link has to start with https://.",
    );
  });
});
