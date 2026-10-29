import { describe, expect, it } from "bun:test";
import {
  facetsFor,
  filterCards,
  filtersHref,
  hasActiveFilters,
  NO_FILTERS,
  normalizeQuery,
  parseContentFilters,
  pickFeatured,
  toQueryString,
  type ContentFilters,
} from "./filters";
import type { ContentCard } from "./published";

const tech = { slug: "tech", name: "Tech" };
const growth = { slug: "growth", name: "Growth" };
const obs = { slug: "obs", name: "OBS" };
const bitrate = { slug: "bitrate", name: "Bitrate" };
const raids = { slug: "raids", name: "Raids" };

function card(overrides: Partial<ContentCard>): ContentCard {
  return {
    id: "id",
    type: "guide",
    path: "/guides/x",
    title: "Untitled",
    excerpt: null,
    cover: null,
    category: null,
    categories: [],
    tags: [],
    authors: [],
    readingMinutes: 3,
    difficulty: null,
    estimatedMinutes: null,
    prerequisiteCount: 0,
    featured: false,
    pinnedRank: null,
    publishedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

const cards = [
  card({ id: "a", title: "Pick a bitrate for OBS", categories: [tech], tags: [obs, bitrate], difficulty: "beginner" }),
  card({ id: "b", title: "Scene design that holds up", categories: [tech], tags: [obs], difficulty: "advanced" }),
  card({ id: "c", title: "Raid etiquette", categories: [growth], tags: [raids], difficulty: "beginner" }),
];
const facets = facetsFor(cards);
const filters = (overrides: Partial<ContentFilters>): ContentFilters => ({ ...NO_FILTERS, ...overrides });

describe("facetsFor", () => {
  it("counts each term once per post, most used first", () => {
    expect(facets.categories).toEqual([
      { ...tech, count: 2 },
      { ...growth, count: 1 },
    ]);
    expect(facets.tags.map((tag) => [tag.slug, tag.count])).toEqual([
      ["obs", 2],
      ["bitrate", 1],
      ["raids", 1],
    ]);
  });

  it("only offers levels that are in use", () => {
    expect(facets.levels.map((level) => level.value)).toEqual(["beginner", "advanced"]);
  });
});

describe("parseContentFilters", () => {
  it("keeps known slugs and drops the rest", () => {
    expect(
      parseContentFilters(
        { q: "  obs   bitrate ", category: "nope", tag: ["raids", "obs", "ghost", "obs"], level: "advanced" },
        "guide",
        facets,
      ),
    ).toEqual({ q: "obs bitrate", category: null, tags: ["obs", "raids"], level: "advanced" });
  });

  it("ignores level on the blog", () => {
    expect(parseContentFilters({ level: "beginner" }, "blog", facets).level).toBeNull();
  });

  it("takes the first value of a repeated single param", () => {
    expect(parseContentFilters({ category: ["growth", "tech"] }, "guide", facets).category).toBe("growth");
  });
});

describe("normalizeQuery", () => {
  it("caps the length", () => {
    expect(normalizeQuery("a".repeat(300))).toHaveLength(100);
  });
});

describe("filterCards", () => {
  const ids = (f: ContentFilters) => filterCards(cards, f).map((c) => c.id);

  it("matches every word of the query in the title, any case and order", () => {
    expect(ids(filters({ q: "OBS pick" }))).toEqual(["a"]);
    expect(ids(filters({ q: "obs raid" }))).toEqual([]);
  });

  it("matches any of the picked tags", () => {
    expect(ids(filters({ tags: ["bitrate", "raids"] }))).toEqual(["a", "c"]);
  });

  it("combines category, tags and level", () => {
    expect(ids(filters({ category: "tech", tags: ["obs"], level: "advanced" }))).toEqual(["b"]);
  });

  it("returns everything without filters", () => {
    expect(ids(NO_FILTERS)).toEqual(["a", "b", "c"]);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });
});

describe("toQueryString", () => {
  it("writes a fixed order with repeated tags", () => {
    expect(toQueryString(filters({ q: "obs", tags: ["raids", "bitrate"], category: "tech", level: "beginner" }))).toBe(
      "q=obs&category=tech&tag=bitrate&tag=raids&level=beginner",
    );
  });

  it("leaves the path bare without filters", () => {
    expect(filtersHref("/guides", NO_FILTERS)).toBe("/guides");
  });
});

describe("pickFeatured", () => {
  it("prefers the best-ranked featured post", () => {
    const list = [
      card({ id: "new", publishedAt: "2026-10-10T00:00:00.000Z" }),
      card({ id: "f2", featured: true, pinnedRank: 2 }),
      card({ id: "f1", featured: true, pinnedRank: 1 }),
    ];
    expect(pickFeatured(list)?.id).toBe("f1");
  });

  it("falls back to the newest, and skips a lone post", () => {
    const list = [card({ id: "old" }), card({ id: "new", publishedAt: "2026-10-10T00:00:00.000Z" })];
    expect(pickFeatured(list)?.id).toBe("new");
    expect(pickFeatured([card({ id: "only" })])).toBeNull();
  });
});
