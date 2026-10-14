import { describe, expect, it } from "bun:test";
import { classifyContentError, toFootprint } from "./content-errors";

describe("classifyContentError", () => {
  it("reads the database functions' prefixes", () => {
    expect(classifyContentError({ message: "cms_conflict" })).toEqual({ kind: "conflict" });
    expect(classifyContentError({ message: "cms_not_found" })).toEqual({ kind: "not_found" });
    expect(classifyContentError({ message: "cms_invalid: at least one author is required" })).toEqual({
      kind: "message",
      message: "Add at least one author.",
    });
    expect(classifyContentError({ message: "cms_invalid: something new" })).toEqual({
      kind: "message",
      message: "Can't do that: something new.",
    });
  });

  it("explains slug clashes and bad slugs", () => {
    expect(
      classifyContentError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "cms_content_slug_key"',
      }),
    ).toMatchObject({
      kind: "message",
    });
    expect(
      classifyContentError({ code: "23514", message: 'violates check constraint "cms_content_slug_check"' }),
    ).toMatchObject({
      kind: "message",
    });
  });

  it("leaves everything else unknown", () => {
    expect(classifyContentError(new Error("socket hang up"))).toEqual({ kind: "unknown" });
    expect(classifyContentError(null)).toEqual({ kind: "unknown" });
  });
});

describe("toFootprint", () => {
  it("maps the snake_case shape", () => {
    expect(toFootprint({ id: "a", type: "guide", category_ids: ["c"], tag_ids: null, author_ids: ["x"] })).toEqual({
      id: "a",
      type: "guide",
      categoryIds: ["c"],
      tagIds: [],
      authorIds: ["x"],
    });
  });

  it("is null for nothing or junk", () => {
    expect(toFootprint(null)).toBeNull();
    expect(toFootprint({ id: "a", type: "news" })).toBeNull();
  });
});
