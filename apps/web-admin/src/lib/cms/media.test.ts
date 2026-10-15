import { describe, expect, it } from "bun:test";
import {
  MAX_AVATAR_BYTES,
  MAX_CONTENT_IMAGE_BYTES,
  cmsAssetFileName,
  cmsAssetKey,
  validateCmsUpload,
  type CmsUploadRequest,
} from "./media";

const ok: CmsUploadRequest = {
  fileName: "OBS output.png",
  mimeType: "image/png",
  size: 1024,
  width: 1600,
  height: 900,
  alt: "OBS output settings",
  decorative: false,
  purpose: "content",
};

describe("validateCmsUpload", () => {
  it("accepts a normal image", () => {
    expect(validateCmsUpload(ok)).toBeNull();
  });

  it.each(["image/svg+xml", "text/html", "application/pdf", ""])("refuses %p", (mimeType) => {
    expect(validateCmsUpload({ ...ok, mimeType })).toContain("SVG isn't allowed");
  });

  it("caps content images at 8 MB and avatars at 2 MB", () => {
    expect(validateCmsUpload({ ...ok, size: MAX_CONTENT_IMAGE_BYTES })).toBeNull();
    expect(validateCmsUpload({ ...ok, size: MAX_CONTENT_IMAGE_BYTES + 1 })).toContain("8 MB");
    expect(validateCmsUpload({ ...ok, purpose: "avatar", size: MAX_AVATAR_BYTES + 1 })).toContain("2 MB");
    expect(validateCmsUpload({ ...ok, size: 0 })).toBe("That file is empty.");
  });

  it("needs alt text unless the image is decorative", () => {
    expect(validateCmsUpload({ ...ok, alt: "   " })).toContain("alt text");
    expect(validateCmsUpload({ ...ok, alt: "", decorative: true })).toBeNull();
    expect(validateCmsUpload({ ...ok, alt: "x".repeat(301) })).toContain("300");
  });

  it("needs a readable size", () => {
    expect(validateCmsUpload({ ...ok, width: 0 })).toContain("image size");
    expect(validateCmsUpload({ ...ok, height: 1.5 })).toContain("image size");
  });
});

describe("cmsAssetKey", () => {
  const id = "0b9f7c1e-6a3d-4c55-9b0e-2f1a8d7e6c4b";
  const now = new Date("2026-03-05T12:00:00Z");

  it("puts the image under its id, by year and month", () => {
    expect(cmsAssetKey(id, "OBS Output Settings.PNG", "image/png", now)).toBe(
      `cms/2026/03/${id}/obs-output-settings.png`,
    );
  });

  it("uses the type's extension, not the file's", () => {
    expect(cmsAssetKey(id, "photo.jpeg", "image/webp", now)).toBe(`cms/2026/03/${id}/photo.webp`);
  });

  it("falls back to image for names with nothing usable", () => {
    expect(cmsAssetKey(id, "🎥.gif", "image/gif", now)).toBe(`cms/2026/03/${id}/image.gif`);
  });

  it("reads the file name back from a key", () => {
    expect(cmsAssetFileName(`cms/2026/03/${id}/obs.png`)).toBe("obs.png");
  });
});
