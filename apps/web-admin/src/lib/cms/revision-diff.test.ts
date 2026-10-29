import { describe, expect, it } from "bun:test";
import type { Doc } from "@repo/cms";
import { compareRevision, diffLines, diffWords, docLines, type ComparableFields } from "./revision-diff";

const text = (value: string) => ({ type: "text", text: value });
const doc = (...content: Doc["content"]): Doc => ({ type: "doc", content });
const heading = (level: number, value: string) => ({ type: "heading", attrs: { level }, content: [text(value)] });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });

function fields(overrides: Partial<ComparableFields> = {}): ComparableFields {
  return {
    title: "Set up OBS",
    slug: "set-up-obs",
    summary: "",
    excerpt: "",
    seoTitle: "",
    seoDescription: "",
    body: doc(paragraph("Intro.")),
    sections: [],
    ...overrides,
  };
}

describe("docLines", () => {
  it("spells out structure, so a heading level change is visible", () => {
    expect(
      docLines(
        doc(heading(3, "Leave room"), paragraph("Text."), {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph("One")] }],
        }),
      ),
    ).toEqual(["### Leave room", "Text.", "• One"]);
  });
});

describe("diffWords", () => {
  it("marks only the words that changed", () => {
    expect(diffWords("Keep usage under 90% please", "Keep usage under 95% please")).toEqual([
      { kind: "same", text: "Keep usage under " },
      { kind: "removed", text: "90% " },
      { kind: "added", text: "95% " },
      { kind: "same", text: "please" },
    ]);
  });
});

describe("diffLines", () => {
  it("pairs a rewritten line and keeps plain removals and additions apart", () => {
    const lines = diffLines(["a", "old line", "c", "gone"], ["a", "new line", "c", "extra"]);
    expect(lines.map((line) => line.kind)).toEqual(["same", "changed", "same", "changed"]);
    expect(diffLines(["a", "b"], ["a"]).map((line) => line.kind)).toEqual(["same", "removed"]);
    expect(diffLines(["a"], ["a", "b"]).map((line) => line.kind)).toEqual(["same", "added"]);
  });
});

describe("compareRevision", () => {
  it("lists only the fields that changed", () => {
    const changed = compareRevision(
      fields({ sections: [{ title: "Check", body: doc(heading(3, "Leave room")) }] }),
      fields({ title: "Set up OBS fast", sections: [{ title: "Check", body: doc(heading(2, "Leave room")) }] }),
      true,
    );
    expect(changed.map((field) => field.label)).toEqual(["Title", "Sections"]);
    expect(changed[1]!.lines[1]).toEqual({
      kind: "changed",
      parts: [
        { kind: "removed", text: "### " },
        { kind: "added", text: "## " },
        { kind: "same", text: "Leave room" },
      ],
    });
  });

  it("finds nothing between identical versions", () => {
    expect(compareRevision(fields(), fields(), false)).toEqual([]);
  });
});
