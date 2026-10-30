import { describe, expect, test } from "bun:test";
import { generateSlug, isLegacySlug, randomSlugSuffix } from "./overlay-slug";

describe("randomSlugSuffix", () => {
  test("is 16 lowercase base36 characters", () => {
    for (let i = 0; i < 1000; i++) {
      expect(randomSlugSuffix()).toMatch(/^[a-z0-9]{16}$/);
    }
  });

  test("does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(randomSlugSuffix());
    expect(seen.size).toBe(10_000);
  });
});

describe("generateSlug", () => {
  test("keeps a readable name prefix", () => {
    expect(generateSlug("Starting Soon!")).toMatch(/^starting-soon-[a-z0-9]{16}$/);
  });

  test("falls back when the name has no usable characters", () => {
    expect(generateSlug("🎮🎮")).toMatch(/^overlay-[a-z0-9]{16}$/);
  });

  test("caps a long name", () => {
    const slug = generateSlug("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(48 + 1 + 16);
  });

  test("never counts as legacy", () => {
    for (let i = 0; i < 100; i++) expect(isLegacySlug(generateSlug("main"))).toBe(false);
  });
});

describe("isLegacySlug", () => {
  test("flags the old 6-character suffix", () => {
    expect(isLegacySlug("main-k3j9x2")).toBe(true);
    expect(isLegacySlug("starting-soon-a1b2")).toBe(true);
  });

  test("flags anything without a 16-character suffix", () => {
    expect(isLegacySlug("shot-starting-soon")).toBe(true);
    expect(isLegacySlug("main-ABCDEFGHIJKLMNOP")).toBe(true);
  });
});
