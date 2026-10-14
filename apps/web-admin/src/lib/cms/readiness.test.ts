import { describe, expect, it } from "bun:test";
import { emptyDoc, type ContentDraft } from "./draft";
import { canPublish, publishReadiness } from "./readiness";

const ID = "11111111-1111-4111-8111-111111111111";

function ready(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    title: "Set up OBS",
    slug: "set-up-obs",
    excerpt: "Everything you need to get OBS streaming to Twitch in fifteen minutes.",
    summary: "Install OBS, add a scene, connect Twitch.",
    coverAssetId: ID,
    body: emptyDoc(),
    seoTitle: "",
    seoDescription: "",
    ogAssetId: null,
    canonicalUrl: "",
    noindex: false,
    primaryCategoryId: null,
    isFeatured: false,
    pinnedRank: null,
    commentsEnabled: true,
    difficulty: "beginner",
    estimatedMinutes: 15,
    prerequisites: [],
    sections: [{ id: ID, title: "Install", body: emptyDoc() }],
    authorIds: [ID],
    categoryIds: [ID],
    tagIds: [],
    relatedIds: [],
    ...overrides,
  };
}

const errors = (
  draft: ContentDraft,
  type: "blog" | "guide" = "guide",
  coverAlt?: { alt: string; decorative: boolean } | null,
) =>
  publishReadiness(type, draft, { coverAlt })
    .filter((item) => item.severity === "error")
    .map((item) => item.message);

describe("publishReadiness", () => {
  it("passes a complete guide", () => {
    const items = publishReadiness("guide", ready(), { coverAlt: { alt: "OBS", decorative: false } });
    expect(items).toEqual([]);
    expect(canPublish(items)).toBe(true);
  });

  it("blocks on the basics", () => {
    expect(errors(ready({ title: " ", authorIds: [], excerpt: "", coverAssetId: null }))).toEqual([
      "Add a title.",
      "Add at least one author.",
      "Write an excerpt: it shows on cards, in search results and in link previews.",
      "Pick a cover image.",
    ]);
  });

  it("refuses the placeholder slug", () => {
    expect(errors(ready({ slug: "untitled-1a2b3c4d" }))).toEqual(["Give it a real slug: it becomes the page's URL."]);
  });

  it("needs alt text on the cover when it is known", () => {
    expect(errors(ready(), "guide", null)).toContain("The cover image needs alt text.");
    expect(errors(ready(), "guide", { alt: "", decorative: false })).toContain("The cover image needs alt text.");
    expect(errors(ready(), "guide", { alt: "", decorative: true })).toEqual([]);
  });

  it("names untitled guide sections", () => {
    const items = publishReadiness("guide", ready({ sections: [{ id: ID, title: "", body: emptyDoc() }] }));
    expect(items).toContainEqual({ severity: "error", message: "Section 1 needs a title.", section: 0 });
  });

  it("includes the accessibility checks", () => {
    const body = { type: "doc" as const, content: [{ type: "image", attrs: { alt: "" } }] };
    expect(errors(ready({ body }), "blog")).toContain(
      "This image needs alt text. Describe what it shows, or mark it as decorative.",
    );
  });

  it("only warns about nice-to-haves", () => {
    const items = publishReadiness("blog", ready({ summary: "", categoryIds: [], excerpt: "Too short." }));
    expect(canPublish(items)).toBe(true);
    expect(items.map((item) => item.severity)).toEqual(["warning", "warning", "warning"]);
  });
});
