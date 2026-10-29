import { describe, expect, it } from "bun:test";
import { BLOCKS, matchBlocks } from "./blocks";

describe("BLOCKS", () => {
  it("names everything in the writer's words", () => {
    // No schema vocabulary on screen: "h2" and "hr" are search terms, not labels.
    for (const block of BLOCKS) expect(block.label).not.toMatch(/^h[1-6]$|node|hr$/i);
  });

  it("has unique ids", () => {
    const ids = BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("matchBlocks", () => {
  it("shows everything for an empty query", () => {
    expect(matchBlocks("")).toHaveLength(BLOCKS.length);
    expect(matchBlocks("   ")).toHaveLength(BLOCKS.length);
  });

  it("finds a block by the name on screen", () => {
    expect(matchBlocks("warn")[0]?.id).toBe("warning");
  });

  it("finds a block by what someone used to call it", () => {
    expect(matchBlocks("h3")[0]?.id).toBe("subheading");
    expect(matchBlocks("youtube")[0]?.id).toBe("embed");
  });

  it("puts a label match before a keyword match", () => {
    // "Note" is a block; it is also a keyword on nothing else that outranks it.
    expect(matchBlocks("note")[0]?.id).toBe("note");
  });

  it("ignores case", () => {
    expect(matchBlocks("TABLE")[0]?.id).toBe("table");
  });

  it("returns nothing when nothing matches", () => {
    expect(matchBlocks("zzzz")).toEqual([]);
  });
});
