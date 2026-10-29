import { describe, expect, it } from "bun:test";
import { classifyLink, depthsPassed } from "./tracking";

describe("depthsPassed", () => {
  it("counts the share of the body above the bottom of the screen", () => {
    expect(depthsPassed(800, 2000, 900)).toEqual([]);
    expect(depthsPassed(400, 2000, 900)).toEqual([25]);
    expect(depthsPassed(-600, 2000, 900)).toEqual([25, 50, 75]);
    expect(depthsPassed(-1200, 2000, 900)).toEqual([25, 50, 75, 100]);
  });

  it("treats a body that fits on screen as read", () => {
    expect(depthsPassed(100, 500, 900)).toEqual([25, 50, 75, 100]);
  });

  it("ignores a body with no height", () => {
    expect(depthsPassed(0, 0, 900)).toEqual([]);
  });
});

describe("classifyLink", () => {
  const page = "https://streamwizard.org/guides/set-up-alerts";

  it("keeps only the path of our own links", () => {
    expect(classifyLink("/pricing?ref=guide", page)).toEqual({ link_type: "internal", target: "/pricing" });
    expect(classifyLink("https://streamwizard.org/overlays#alerts", page)).toEqual({
      link_type: "internal",
      target: "/overlays",
    });
  });

  it("keeps only the host of other sites", () => {
    expect(classifyLink("https://docs.streamwizard.org/widgets/alert-box?x=1", page)).toEqual({
      link_type: "external",
      target: "docs.streamwizard.org",
    });
    expect(classifyLink("mailto:hi@example.com", page)).toEqual({ link_type: "external", target: "mailto" });
  });

  it("skips in-page anchors and other schemes", () => {
    expect(classifyLink("#step-2", page)).toBeNull();
    expect(classifyLink("javascript:alert(1)", page)).toBeNull();
  });
});
