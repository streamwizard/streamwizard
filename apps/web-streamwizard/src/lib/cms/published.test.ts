import { describe, expect, it } from "bun:test";
import {
  articleBreadcrumbSchema,
  articleMeta,
  articleSchema,
  authorSameAs,
  inOrder,
  splitTitle,
  toArticle,
  toCard,
  type PublicTaxonomy,
  type PublishedRow,
} from "./published";

const COVER = "11111111-1111-4111-8111-111111111111";
const OG = "22222222-2222-4222-8222-222222222222";
const AUTHOR = "33333333-3333-4333-8333-333333333333";
const CATEGORY = "44444444-4444-4444-8444-444444444444";
const OTHER_CATEGORY = "55555555-5555-4555-8555-555555555555";
const TAG = "66666666-6666-4666-8666-666666666666";

const absoluteUrl = (path: string) => new URL(path, "https://streamwizard.org").toString();
const imageUrl = (key: string) => `https://cdn.example/${key}`;

const taxonomy: PublicTaxonomy = {
  authors: {
    [AUTHOR]: {
      id: AUTHOR,
      slug: "jochem",
      name: "Jochem",
      roleTitle: "Founder",
      avatarKey: "cms/avatar.png",
      sameAs: ["https://twitch.tv/jochemwhite"],
    },
  },
  categories: {
    [CATEGORY]: { slug: "overlays", name: "Overlays" },
    [OTHER_CATEGORY]: { slug: "obs", name: "OBS" },
  },
  tags: { [TAG]: { slug: "alerts", name: "Alerts" } },
};

function row(overrides: Partial<PublishedRow> = {}): PublishedRow {
  return {
    content_id: "77777777-7777-4777-8777-777777777777",
    type: "guide",
    slug: "set-up-alerts",
    title: "Set up alerts",
    excerpt: "Add an alert box to OBS in five minutes.",
    summary: "Add the alert box widget, copy its URL into OBS, done.",
    cover: { asset_id: COVER },
    og_image: null,
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] },
    sections: [{ id: "s1", title: "Add the widget", anchor: "add-the-widget", body: { type: "doc", content: [] } }],
    assets: {
      [COVER]: {
        key: "cms/cover.png",
        width: 1600,
        height: 900,
        mime_type: "image/png",
        alt: "The alert box",
        decorative: false,
      },
      [OG]: { key: "cms/og.jpg", width: 1200, height: 630, mime_type: "image/jpeg", alt: "", decorative: true },
    },
    word_count: 420,
    reading_time_minutes: 3,
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    noindex: false,
    difficulty: "beginner",
    estimated_minutes: 10,
    prerequisites: [{ text: "OBS installed" }],
    author_ids: [AUTHOR],
    category_ids: [OTHER_CATEGORY, CATEGORY],
    tag_ids: [TAG],
    related_ids: [],
    primary_category_id: CATEGORY,
    is_featured: false,
    pinned_rank: null,
    first_published_at: "2026-10-01T10:00:00.000Z",
    content_updated_at: "2026-10-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("toArticle", () => {
  it("resolves the cover, authors and taxonomy, primary category first", () => {
    const article = toArticle(row(), taxonomy, imageUrl);
    expect(article.cover).toEqual({
      src: "https://cdn.example/cms/cover.png",
      width: 1600,
      height: 900,
      alt: "The alert box",
    });
    expect(article.authors).toEqual([
      { name: "Jochem", roleTitle: "Founder", avatarUrl: "https://cdn.example/cms/avatar.png" },
    ]);
    expect(article.categories).toEqual(["Overlays", "OBS"]);
    expect(article.tags).toEqual(["Alerts"]);
    expect(article.prerequisites).toEqual(["OBS installed"]);
    expect(article.sections.map((section) => section.title)).toEqual(["Add the widget"]);
    expect(article.difficulty).toBe("beginner");
  });

  it("drops guide-only fields from blog posts and skips a cover that wasn't published", () => {
    const article = toArticle(row({ type: "blog", cover: { asset_id: "missing" } }), taxonomy, imageUrl);
    expect(article.cover).toBeNull();
    expect(article.sections).toEqual([]);
    expect(article.difficulty).toBeNull();
    expect(article.prerequisites).toEqual([]);
  });

  it("gives a decorative cover empty alt text", () => {
    const article = toArticle(row({ cover: { asset_id: OG } }), taxonomy, imageUrl);
    expect(article.cover?.alt).toBe("");
  });
});

describe("toCard", () => {
  it("links to the post and names its primary category", () => {
    const card = toCard(row(), taxonomy, imageUrl);
    expect(card.path).toBe("/guides/set-up-alerts");
    expect(card.category).toEqual({ slug: "overlays", name: "Overlays" });
    expect(card.categories.map((term) => term.slug)).toEqual(["overlays", "obs"]);
    expect(card.tags).toEqual([{ slug: "alerts", name: "Alerts" }]);
    expect(card.prerequisiteCount).toBe(1);
    expect(card.authors).toEqual(["Jochem"]);
  });
});

describe("inOrder", () => {
  it("keeps the hand-picked order and skips posts that aren't live", () => {
    expect(inOrder(["b", "x", "a"], [{ id: "a" }, { id: "b" }]).map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("articleMeta", () => {
  it("falls back from the SEO fields to the title and excerpt", () => {
    expect(articleMeta(row(), absoluteUrl)).toMatchObject({
      title: "Set up alerts",
      description: "Add an alert box to OBS in five minutes.",
      canonical: "https://streamwizard.org/guides/set-up-alerts",
    });
    expect(
      articleMeta(row({ seo_title: "Alerts in OBS", canonical_url: "https://example.com/original" }), absoluteUrl),
    ).toMatchObject({ title: "Alerts in OBS", canonical: "https://example.com/original" });
  });
});

describe("articleSchema", () => {
  it("describes a guide as a TechArticle led by its summary", () => {
    const schema = articleSchema(row({ og_image: { asset_id: OG } }), taxonomy, { absoluteUrl, imageUrl });
    expect(schema).toMatchObject({
      "@type": "TechArticle",
      "@id": "https://streamwizard.org/guides/set-up-alerts#article",
      description: "Add the alert box widget, copy its URL into OBS, done.",
      image: ["https://cdn.example/cms/og.jpg"],
      author: [{ "@type": "Person", name: "Jochem", sameAs: ["https://twitch.tv/jochemwhite"] }],
      articleSection: "Overlays",
      keywords: "Alerts",
      proficiencyLevel: "Beginner",
      timeRequired: "PT10M",
      datePublished: "2026-10-01T10:00:00.000Z",
      dateModified: "2026-10-05T10:00:00.000Z",
    });
  });

  it("describes a blog post as a BlogPosting without guide fields", () => {
    const schema = articleSchema(row({ type: "blog", slug: "launch" }), taxonomy, { absoluteUrl, imageUrl });
    expect(schema["@type"]).toBe("BlogPosting");
    expect(schema.proficiencyLevel).toBeUndefined();
    expect(schema.timeRequired).toBeUndefined();
    expect(schema.image).toEqual(["https://cdn.example/cms/cover.png"]);
  });

  it("builds Home, section, post breadcrumbs", () => {
    const crumbs = articleBreadcrumbSchema(row({ type: "blog", slug: "launch", title: "Launch" }), absoluteUrl);
    expect((crumbs.itemListElement as { item: string }[]).map((item) => item.item)).toEqual([
      "https://streamwizard.org/",
      "https://streamwizard.org/blog",
      "https://streamwizard.org/blog/launch",
    ]);
  });
});

describe("splitTitle", () => {
  it("splits near the middle on a space", () => {
    expect(splitTitle("Set up alerts in OBS")).toEqual(["Set up", "alerts in OBS"]);
    expect(splitTitle("Add a chat box to your stream")).toEqual(["Add a chat box", "to your stream"]);
  });

  it("cuts long lines at a word", () => {
    const [first, second] = splitTitle("A very long guide title that keeps going well past what fits on a share card");
    expect(first.length).toBeLessThanOrEqual(30);
    expect(second.length).toBeLessThanOrEqual(30);
    expect(second.endsWith("…")).toBe(true);
  });

  it("handles one word and nothing", () => {
    expect(splitTitle("Alerts")).toEqual(["Alerts", ""]);
    expect(splitTitle("  ")).toEqual(["Untitled", ""]);
  });
});

describe("authorSameAs", () => {
  it("keeps https links only", () => {
    expect(authorSameAs({ twitch: "https://twitch.tv/x", x: "http://x.com/y", website: "javascript:1" })).toEqual([
      "https://twitch.tv/x",
    ]);
    expect(authorSameAs(null)).toEqual([]);
  });
});
