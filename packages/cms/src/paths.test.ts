import { describe, expect, it } from "bun:test";
import { contentIndexPath, contentPath } from "./paths";

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
