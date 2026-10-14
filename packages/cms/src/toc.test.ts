import { describe, expect, it } from "bun:test";
import type { Doc } from "./doc";
import { AnchorRegistry, extractToc } from "./toc";

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
