import { describe, expect, it } from "bun:test";
import { kindFromMime } from "./asset-mime";

describe("kindFromMime", () => {
  it("maps allowlisted types", () => {
    expect(kindFromMime("image/png")).toBe("image");
    expect(kindFromMime("audio/mpeg")).toBe("audio");
    expect(kindFromMime("video/webm")).toBe("video");
    expect(kindFromMime("application/json")).toBe("lottie");
  });

  it("accepts the WAV and MP3 aliases browsers report", () => {
    expect(kindFromMime("audio/x-wav")).toBe("audio");
    expect(kindFromMime("audio/wave")).toBe("audio");
    expect(kindFromMime("audio/vnd.wave")).toBe("audio");
    expect(kindFromMime("audio/mp3")).toBe("audio");
    expect(kindFromMime("Audio/X-WAV")).toBe("audio");
  });

  it("rejects SVG, HTML, empty and unknown types", () => {
    expect(kindFromMime("image/svg+xml")).toBeNull();
    expect(kindFromMime("text/html")).toBeNull();
    expect(kindFromMime("")).toBeNull();
    expect(kindFromMime("audio/x-m4a")).toBeNull();
    expect(kindFromMime("image/")).toBeNull();
  });
});
