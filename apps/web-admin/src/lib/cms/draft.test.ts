import { describe, expect, it } from "bun:test";
import type { Doc } from "@repo/cms";
import { canonicalProblem, deriveDraft, draftSchema, emptyDoc, type ContentDraft } from "./draft";

const CATEGORY = "11111111-1111-4111-8111-111111111111";

function doc(...content: Doc["content"]): Doc {
  return { type: "doc", content };
}
const heading = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

function draft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    title: "  Set up OBS  ",
    slug: "set-up-obs",
    excerpt: "",
    summary: "Short answer",
    coverAssetId: null,
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
    prerequisites: [" A Twitch account ", ""],
    sections: [],
    authorIds: [],
    categoryIds: [],
    tagIds: [],
    relatedIds: [],
    ...overrides,
  };
}

describe("deriveDraft", () => {
  it("trims text and stores blanks as null", () => {
    const { fields } = deriveDraft("blog", draft());
    expect(fields.title).toBe("Set up OBS");
    expect(fields.excerpt).toBeNull();
    expect(fields.summary).toBe("Short answer");
  });

  it("drops guide fields from blog posts", () => {
    const { fields, sections } = deriveDraft(
      "blog",
      draft({ sections: [{ id: CATEGORY, title: "x", anchor: null, body: emptyDoc() }] }),
    );
    expect(fields).toMatchObject({ difficulty: null, estimated_minutes: null, prerequisites: [] });
    expect(sections).toBeNull();
  });

  it("keeps guide fields and cleans prerequisites", () => {
    expect(deriveDraft("guide", draft()).fields).toMatchObject({
      difficulty: "beginner",
      estimated_minutes: 15,
      prerequisites: [{ text: "A Twitch account" }],
    });
  });

  it("builds one table of contents across intro and sections, with unique anchors", () => {
    const derived = deriveDraft(
      "guide",
      draft({
        body: doc(heading(2, "Setup")),
        sections: [
          { id: CATEGORY, title: "Setup", anchor: null, body: doc(heading(3, "Windows")) },
          { id: "22222222-2222-4222-8222-222222222222", title: "", anchor: null, body: doc(paragraph("words here")) },
        ],
      }),
    );
    expect(derived.toc).toEqual([
      { level: 2, text: "Setup", anchor: "setup" },
      { level: 2, text: "Setup", anchor: "setup-2" },
      { level: 3, text: "Windows", anchor: "windows" },
      { level: 2, text: "", anchor: "section-2" },
    ]);
    expect(derived.sections?.map((section) => section.anchor)).toEqual(["setup-2", "section-2"]);
    expect(derived.sections?.[1]?.body_text).toBe("words here");
    expect(derived.fields.toc).toBe(derived.toc);
  });

  it("counts reading time over every section", () => {
    const words = Array.from({ length: 450 }, () => "word").join(" ");
    const derived = deriveDraft(
      "guide",
      draft({ sections: [{ id: CATEGORY, title: "A", anchor: null, body: doc(paragraph(words)) }] }),
    );
    expect(derived.words).toBe(450);
    expect(derived.fields).toMatchObject({ word_count: 450, reading_time_minutes: 2 });
  });

  it("cleans bodies and reports what it removed", () => {
    const derived = deriveDraft("blog", draft({ body: doc({ type: "iframe" }, paragraph("ok")) }));
    expect((derived.fields.body as Doc).content).toEqual([paragraph("ok")]);
    expect(derived.removed).toEqual([{ where: "body", issues: [expect.objectContaining({ code: "unknown_node" })] }]);
  });

  it("only keeps a primary category the post actually has", () => {
    expect(deriveDraft("blog", draft({ primaryCategoryId: CATEGORY })).fields.primary_category_id).toBeNull();
    expect(
      deriveDraft("blog", draft({ primaryCategoryId: CATEGORY, categoryIds: [CATEGORY] })).fields.primary_category_id,
    ).toBe(CATEGORY);
  });
});

describe("draftSchema", () => {
  it("accepts a normal draft", () => {
    expect(draftSchema.safeParse(draft()).success).toBe(true);
  });

  it("refuses ids that aren't uuids and oversized text", () => {
    expect(draftSchema.safeParse(draft({ authorIds: ["nope"] })).success).toBe(false);
    expect(draftSchema.safeParse(draft({ title: "x".repeat(201) })).success).toBe(false);
  });
});

describe("canonicalProblem", () => {
  it("allows blank and https", () => {
    expect(canonicalProblem("")).toBeNull();
    expect(canonicalProblem("https://docs.streamwizard.org/widgets")).toBeNull();
  });

  it("refuses http and junk", () => {
    expect(canonicalProblem("http://example.com")).toContain("https://");
    expect(canonicalProblem("not a url")).toContain("isn't a full URL");
  });
});
