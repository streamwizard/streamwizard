import { describe, expect, it } from "bun:test";
import type { Doc } from "./doc";
import { AnchorRegistry, extractToc, pageOutline } from "./toc";

function heading(level: number, text: string) {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

describe("extractToc", () => {
  it("lists headings in order with unique anchors", () => {
    const doc: Doc = {
      type: "doc",
      content: [
        heading(2, "Install OBS"),
        heading(3, "Windows"),
        heading(2, "Install OBS"),
        { type: "heading", attrs: { level: 2 } },
      ],
    };
    expect(extractToc(doc)).toEqual([
      { level: 2, text: "Install OBS", anchor: "install-obs" },
      { level: 3, text: "Windows", anchor: "windows" },
      { level: 2, text: "Install OBS", anchor: "install-obs-2" },
      { level: 2, text: "", anchor: "section" },
    ]);
  });

  it("shares anchors across the docs of one page", () => {
    const anchors = new AnchorRegistry();
    anchors.claim("Setup");
    expect(extractToc({ type: "doc", content: [heading(3, "Setup")] }, anchors)[0]?.anchor).toBe("setup-2");
  });
});

describe("pageOutline", () => {
  it("numbers anchors across body and sections the same way every time", () => {
    const body: Doc = { type: "doc", content: [heading(2, "Setup")] };
    const sections = [
      { title: "Setup", body: { type: "doc", content: [heading(3, "Windows")] } as Doc },
      { title: "", body: { type: "doc", content: [] } as Doc },
    ];
    const outline = pageOutline(body, sections);
    expect(outline.bodyAnchors).toEqual(["setup"]);
    expect(outline.sections).toEqual([
      { anchor: "setup-2", headingAnchors: ["windows"] },
      { anchor: "section-2", headingAnchors: [] },
    ]);
    expect(outline.toc.map((entry) => entry.anchor)).toEqual(["setup", "setup-2", "windows", "section-2"]);
    expect(pageOutline(body, sections)).toEqual(outline);
  });
});
