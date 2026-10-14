import { describe, expect, it } from "bun:test";
import type { Doc, DocNode } from "./doc";
import { countWords, extractText, readingStats } from "./text";

function p(value: string): DocNode {
  return { type: "paragraph", content: [{ type: "text", text: value }] };
}
function words(n: number): string {
  return Array.from({ length: n }, () => "word").join(" ");
}

describe("extractText", () => {
  it("gives one line per block, including nested ones", () => {
    const doc: Doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Setup" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [p("Open OBS")] }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line one" }, { type: "hardBreak" }, { type: "text", text: "line two" }],
        },
        { type: "image", attrs: { alt: "ignored" } },
        { type: "paragraph" },
      ],
    };
    expect(extractText(doc)).toBe("Setup\nOpen OBS\nLine one\nline two");
  });
});

describe("countWords", () => {
  it("counts tokens with a letter or digit", () => {
    expect(countWords("Set up OBS in 5 minutes - easy!")).toBe(7);
    expect(countWords("  ")).toBe(0);
  });
});

describe("readingStats", () => {
  it("is at least one minute", () => {
    expect(readingStats([{ type: "doc", content: [] }])).toEqual({ words: 0, minutes: 1 });
  });

  it("reads 225 words a minute across body and sections", () => {
    const body: Doc = { type: "doc", content: [p(words(450))] };
    const section: Doc = { type: "doc", content: [p(words(225))] };
    expect(readingStats([body, section])).toEqual({ words: 675, minutes: 3 });
  });

  it("counts code at half weight and adds time for images", () => {
    const doc: Doc = {
      type: "doc",
      content: [
        { type: "codeBlock", content: [{ type: "text", text: words(450) }] },
        ...Array.from({ length: 5 }, () => ({ type: "image" })),
      ],
    };
    // 450 code words = 1 min, 5 images = 1 min.
    expect(readingStats([doc])).toEqual({ words: 450, minutes: 2 });
  });
});
