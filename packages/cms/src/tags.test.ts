import { describe, expect, it } from "bun:test";
import { cmsTags, isCmsTag, tagsForChange, type PublicFootprint } from "./tags";

const POST = "11111111-1111-4111-8111-111111111111";
const CAT_A = "22222222-2222-4222-8222-222222222222";
const CAT_B = "33333333-3333-4333-8333-333333333333";
const TAG_A = "44444444-4444-4444-8444-444444444444";
const AUTHOR = "55555555-5555-4555-8555-555555555555";

const published: PublicFootprint = {
  id: POST,
  type: "guide",
  categoryIds: [CAT_A],
  tagIds: [TAG_A],
  authorIds: [AUTHOR],
};

describe("isCmsTag", () => {
  it("accepts every tag the builders produce", () => {
    for (const tag of [
      cmsTags.all,
      cmsTags.content(POST),
      cmsTags.list("blog"),
      cmsTags.list("guide"),
      cmsTags.listAll,
      cmsTags.category(CAT_A),
      cmsTags.tag(TAG_A),
      cmsTags.author(AUTHOR),
      cmsTags.taxonomy,
      cmsTags.sitemap,
      cmsTags.comments(POST),
    ]) {
      expect(isCmsTag(tag)).toBe(true);
    }
  });

  it.each([
    "",
    "cms:",
    "cms:content:abc",
    "cms:list:news",
    "showcase-clips",
    `cms:content:${POST}:x`,
    `x-cms:content:${POST}`,
  ])("rejects %p", (tag) => {
    expect(isCmsTag(tag)).toBe(false);
  });
});

describe("tagsForChange", () => {
  it("touches nothing for a draft that stays a draft", () => {
    expect(tagsForChange(null, null)).toEqual([]);
  });

  it("refreshes the post, its lists, taxonomy pages and the sitemap on publish", () => {
    expect(tagsForChange(null, published).sort()).toEqual(
      [
        cmsTags.listAll,
        cmsTags.sitemap,
        cmsTags.content(POST),
        cmsTags.list("guide"),
        cmsTags.category(CAT_A),
        cmsTags.tag(TAG_A),
        cmsTags.author(AUTHOR),
      ].sort(),
    );
  });

  it("refreshes the same pages when the post leaves the site", () => {
    expect(tagsForChange(published, null).sort()).toEqual(tagsForChange(null, published).sort());
  });

  it("refreshes both the old and the new category when a post moves", () => {
    const tags = tagsForChange(published, { ...published, categoryIds: [CAT_B], tagIds: [] });
    expect(tags).toContain(cmsTags.category(CAT_A));
    expect(tags).toContain(cmsTags.category(CAT_B));
    expect(tags).toContain(cmsTags.tag(TAG_A));
  });

  it("never repeats a tag and only returns valid ones", () => {
    const tags = tagsForChange(published, published);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags.every(isCmsTag)).toBe(true);
  });
});
