import { describe, expect, test } from "bun:test";
import { matchTags, searchTags } from "./tags";

const tag = (name: string, keywords: string[], auto_reply = true) => ({ name, trigger_keywords: keywords, auto_reply });

describe("matchTags", () => {
  test("matches keywords as case-insensitive substrings, in tag order", () => {
    const tags = [tag("obs", ["obs won't connect", "connect"]), tag("refund", ["refund"]), tag("hi", ["hello"])];
    expect(matchTags(tags, "Hello, my OBS won't CONNECT and I want a refund").map((t) => t.name)).toEqual(["obs", "refund", "hi"]);
  });

  test("skips tags without auto-reply, empty keywords and empty messages", () => {
    const tags = [tag("manual", ["help"], false), tag("blank", ["", "  "]), tag("help", ["help"])];
    expect(matchTags(tags, "help me").map((t) => t.name)).toEqual(["help"]);
    expect(matchTags(tags, "   ")).toEqual([]);
  });

  test("regex characters in keywords are just characters", () => {
    expect(matchTags([tag("q", ["(a+)+$"])], "aaaa").length).toBe(0);
    expect(matchTags([tag("q", ["(a+)+$"])], "literally (a+)+$ here").length).toBe(1);
  });
});

describe("searchTags", () => {
  test("filters by name and caps the list", () => {
    const tags = Array.from({ length: 30 }, (_, i) => tag(`tag-${i}`, []));
    expect(searchTags(tags, "").length).toBe(25);
    expect(searchTags(tags, "TAG-2").map((t) => t.name)).toEqual(["tag-2", ...Array.from({ length: 10 }, (_, i) => `tag-2${i}`)]);
  });
});
