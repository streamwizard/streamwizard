import { describe, expect, it } from "bun:test";
import { contentIndexPath, contentPath, isContentPath } from "./paths";

describe("contentPath", () => {
  it("puts blog posts under /blog and guides under /guides", () => {
    expect(contentPath("blog", "launch-week")).toBe("/blog/launch-week");
    expect(contentPath("guide", "set-up-alerts")).toBe("/guides/set-up-alerts");
    expect(contentIndexPath("guide")).toBe("/guides");
  });

  it("never lets a slug break out of its segment", () => {
    expect(contentPath("blog", "../admin")).toBe("/blog/..%2Fadmin");
  });
});

describe("isContentPath", () => {
  it("accepts the indexes and posts under them", () => {
    expect(isContentPath("/blog")).toBe(true);
    expect(isContentPath("/guides/set-up-alerts")).toBe(true);
  });

  it("refuses everything else", () => {
    for (const path of [
      "/",
      "/pricing",
      "/blog/",
      "/blog/a/b",
      "/blog/Bad_Slug",
      "https://x.com/blog",
      "/guides/../admin",
    ]) {
      expect(isContentPath(path)).toBe(false);
    }
  });
});
