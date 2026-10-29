import { describe, expect, it } from "bun:test";
import { isValidSlug, MAX_SLUG_LENGTH, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["How to set up OBS (2026)", "how-to-set-up-obs-2026"],
    ["Café & chat overlays", "cafe-and-chat-overlays"],
    ["  --Already--slugged--  ", "already-slugged"],
    ["🚀 Go live", "go-live"],
    ["", ""],
  ])("%s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("cuts long titles on a word boundary", () => {
    const slug = slugify("the quick brown fox jumps over the lazy dog ".repeat(5));
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase words joined by single dashes", () => {
    expect(isValidSlug("obs-setup-2")).toBe(true);
  });

  it.each(["", "Obs", "obs--setup", "-obs", "obs-", "obs_setup", "a".repeat(MAX_SLUG_LENGTH + 1)])(
    "rejects %p",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});
