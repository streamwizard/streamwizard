import { describe, expect, it } from "bun:test";
import { anchorUpdates, type HeadingState } from "./heading-anchors";

const heading = (overrides: Partial<HeadingState> = {}): HeadingState => ({
  pos: 0,
  text: "Set up OBS",
  anchor: null,
  holdsSelection: false,
  ...overrides,
});

describe("anchorUpdates", () => {
  it("gives a new heading an anchor from its words", () => {
    expect(anchorUpdates([heading()])).toEqual([{ pos: 0, anchor: "set-up-obs" }]);
  });

  it("waits while the heading is still being typed", () => {
    expect(anchorUpdates([heading({ holdsSelection: true })])).toEqual([]);
  });

  it("never moves an anchor a heading already has", () => {
    // The whole point: #set-up-obs still works after the rewording.
    expect(anchorUpdates([heading({ text: "Getting started", anchor: "set-up-obs" })])).toEqual([]);
  });

  it("clears the anchor of an emptied heading", () => {
    expect(anchorUpdates([heading({ text: "   ", anchor: "set-up-obs" })])).toEqual([{ pos: 0, anchor: null }]);
  });

  it("leaves an empty heading that never had one alone", () => {
    expect(anchorUpdates([heading({ text: "" })])).toEqual([]);
  });

  it("keeps two headings with the same words apart", () => {
    const updates = anchorUpdates([heading({ pos: 0 }), heading({ pos: 10 })]);
    expect(updates).toEqual([
      { pos: 0, anchor: "set-up-obs" },
      { pos: 10, anchor: "set-up-obs-2" },
    ]);
  });

  it("works around an anchor already in use", () => {
    const updates = anchorUpdates([heading({ pos: 0, anchor: "set-up-obs" }), heading({ pos: 10 })]);
    expect(updates).toEqual([{ pos: 10, anchor: "set-up-obs-2" }]);
  });

  it("skips a heading whose words make no slug", () => {
    expect(anchorUpdates([heading({ text: "!!! ???" })])).toEqual([]);
  });

  it("shortens a long heading to a usable fragment", () => {
    const anchor = anchorUpdates([heading({ text: "a".repeat(200) })])[0]?.anchor ?? "";
    expect(anchor.length).toBeLessThanOrEqual(60);
    expect(anchor.length).toBeGreaterThan(0);
  });
});
