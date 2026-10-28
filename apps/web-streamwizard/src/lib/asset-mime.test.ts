import { describe, expect, it } from "bun:test";
import { kindFromMime, uploadMimeType } from "./asset-mime";

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

describe("fonts", () => {
  it("takes woff2 and woff, under the names systems report them by", () => {
    expect(kindFromMime("font/woff2")).toBe("font");
    expect(kindFromMime("font/woff")).toBe("font");
    expect(kindFromMime("application/font-woff")).toBe("font");
    expect(kindFromMime("application/x-font-woff")).toBe("font");
    expect(kindFromMime("font/ttf")).toBeNull();
    expect(kindFromMime("font/otf")).toBeNull();
  });

  it("names a font with no type from its extension", () => {
    expect(uploadMimeType({ name: "Brand.woff2", type: "" })).toBe("font/woff2");
    expect(uploadMimeType({ name: "Brand.WOFF", type: "application/octet-stream" })).toBe("font/woff");
    expect(uploadMimeType({ name: "Brand.woff2", type: "font/woff2" })).toBe("font/woff2");
  });

  it("guesses nothing else from an extension", () => {
    expect(uploadMimeType({ name: "logo.png", type: "" })).toBe("");
    expect(uploadMimeType({ name: "page.woff2", type: "text/html" })).toBe("text/html");
  });
});
