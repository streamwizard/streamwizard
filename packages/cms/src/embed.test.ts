import { describe, expect, it } from "bun:test";
import { embedSrc, parseEmbedUrl } from "./embed";

describe("parseEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "youtube", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://clips.twitch.tv/FunnyClipSlug-abc123", "twitch_clip", "FunnyClipSlug-abc123"],
    ["https://clips.twitch.tv/embed?clip=FunnyClipSlug&parent=x", "twitch_clip", "FunnyClipSlug"],
    ["https://www.twitch.tv/xpudu/clip/FunnyClipSlug", "twitch_clip", "FunnyClipSlug"],
    ["https://www.twitch.tv/videos/2280000001", "twitch_video", "2280000001"],
  ])("reads %s", (url, provider, id) => {
    expect(parseEmbedUrl(url)).toEqual({ provider: provider as never, id });
  });

  it.each([
    "https://www.youtube.com/channel/UC123",
    "https://youtu.be/short",
    "https://www.twitch.tv/xpudu",
    "https://vimeo.com/123",
    "javascript:alert(1)",
    "not a url",
  ])("ignores %s", (url) => {
    expect(parseEmbedUrl(url)).toBeNull();
  });
});

describe("embedSrc", () => {
  it("builds privacy-friendly YouTube and parent-scoped Twitch URLs", () => {
    expect(embedSrc({ provider: "youtube", id: "dQw4w9WgXcQ" }, "streamwizard.org")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(embedSrc({ provider: "twitch_clip", id: "Clip-1" }, "streamwizard.org")).toBe(
      "https://clips.twitch.tv/embed?clip=Clip-1&parent=streamwizard.org&autoplay=false",
    );
    expect(embedSrc({ provider: "twitch_video", id: "123" }, "localhost")).toBe(
      "https://player.twitch.tv/?video=123&parent=localhost&autoplay=false",
    );
  });
});
