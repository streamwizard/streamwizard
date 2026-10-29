import { contentIndexPath, contentPath, migrateDoc, type ContentType, type Doc } from "@repo/cms";
import type { ArticleData } from "@/components/public/cms/cms-article";
import type { AssetRecord } from "./images";

// Pure: a published row (cms_content_published) and the taxonomy it points
// at, turned into what the article, the cards, the metadata and the JSON-LD
// need. URLs come in as functions so this file has no env and no I/O.

export interface PublishedAsset extends AssetRecord {
  mimeType: string | null;
  alt: string | null;
  decorative: boolean;
}

/** The columns of cms_content_published a detail page reads. */
export interface PublishedRow {
  content_id: string;
  type: string;
  slug: string;
  title: string;
  excerpt: string | null;
  summary: string | null;
  cover: unknown;
  og_image: unknown;
  body: unknown;
  sections: unknown;
  assets: unknown;
  word_count: number;
  reading_time_minutes: number;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  difficulty: string | null;
  estimated_minutes: number | null;
  prerequisites: unknown;
  author_ids: string[];
  category_ids: string[];
  tag_ids: string[];
  related_ids: string[];
  primary_category_id: string | null;
  is_featured: boolean;
  pinned_rank: number | null;
  first_published_at: string;
  content_updated_at: string;
}

/** The columns a card reads. */
export type PublishedCardRow = Pick<
  PublishedRow,
  | "content_id"
  | "type"
  | "slug"
  | "title"
  | "excerpt"
  | "cover"
  | "assets"
  | "reading_time_minutes"
  | "difficulty"
  | "estimated_minutes"
  | "prerequisites"
  | "author_ids"
  | "category_ids"
  | "tag_ids"
  | "primary_category_id"
  | "is_featured"
  | "pinned_rank"
  | "first_published_at"
  | "content_updated_at"
>;

export interface PublicAuthor {
  id: string;
  slug: string;
  name: string;
  roleTitle: string | null;
  avatarKey: string | null;
  /** https profile links, for JSON-LD sameAs. */
  sameAs: string[];
}

export interface PublicTaxonomy {
  authors: Record<string, PublicAuthor>;
  categories: Record<string, { slug: string; name: string }>;
  tags: Record<string, { slug: string; name: string }>;
}

/** A category or tag as the index filters and the cards use it. */
export interface Term {
  slug: string;
  name: string;
}

export interface ContentCard {
  id: string;
  type: ContentType;
  path: string;
  title: string;
  excerpt: string | null;
  cover: { src: string; width: number | null; height: number | null; alt: string } | null;
  /** The primary category. */
  category: Term | null;
  /** Every category, primary first. */
  categories: Term[];
  tags: Term[];
  authors: string[];
  readingMinutes: number;
  difficulty: ArticleData["difficulty"];
  /** Guides only. */
  estimatedMinutes: number | null;
  /** Guides only. */
  prerequisiteCount: number;
  featured: boolean;
  pinnedRank: number | null;
  publishedAt: string;
}

export const DIFFICULTY_LABELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
export type Difficulty = keyof typeof DIFFICULTY_LABELS;

/** "12 Oct 2026" on cards, "12 October 2026" on the article. UTC so server and client agree. */
export const SHORT_DATE = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const LONG_DATE = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type ImageUrl = (key: string) => string;

const DIFFICULTIES = new Set(Object.keys(DIFFICULTY_LABELS));

export function asContentType(value: string): ContentType {
  return value === "guide" ? "guide" : "blog";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asDoc = (value: unknown): Doc => migrateDoc(value).doc;

const asDifficulty = (value: string | null): ArticleData["difficulty"] =>
  value && DIFFICULTIES.has(value) ? (value as ArticleData["difficulty"]) : null;

/** The assets map cms_publish stored: { [assetId]: { key, width, height, alt, decorative } }. */
export function publishedAssets(value: unknown): Map<string, PublishedAsset> {
  const assets = new Map<string, PublishedAsset>();
  if (!isRecord(value)) return assets;
  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw) || typeof raw.key !== "string") continue;
    assets.set(id, {
      key: raw.key,
      width: typeof raw.width === "number" ? raw.width : null,
      height: typeof raw.height === "number" ? raw.height : null,
      mimeType: typeof raw.mime_type === "string" ? raw.mime_type : null,
      alt: typeof raw.alt === "string" ? raw.alt : null,
      decorative: raw.decorative === true,
    });
  }
  return assets;
}

/** The asset a { asset_id } column (cover, og_image) points at, if it was published with the post. */
function referencedAsset(value: unknown, assets: Map<string, PublishedAsset>): PublishedAsset | null {
  if (!isRecord(value) || typeof value.asset_id !== "string") return null;
  return assets.get(value.asset_id) ?? null;
}

function coverImage(row: Pick<PublishedRow, "cover" | "assets" | "title">, imageUrl: ImageUrl) {
  const asset = referencedAsset(row.cover, publishedAssets(row.assets));
  if (!asset) return null;
  return {
    src: imageUrl(asset.key),
    width: asset.width,
    height: asset.height,
    alt: asset.decorative ? "" : (asset.alt ?? ""),
  };
}

/** Categories with the primary one first. */
function categoryTerms(row: Pick<PublishedRow, "category_ids" | "primary_category_id">, taxonomy: PublicTaxonomy): Term[] {
  // `?? []`: a list cached before the card read these columns doesn't have them.
  const all = row.category_ids ?? [];
  const ids = row.primary_category_id
    ? [row.primary_category_id, ...all.filter((id) => id !== row.primary_category_id)]
    : all;
  return ids.flatMap((id) => (taxonomy.categories[id] ? [taxonomy.categories[id]] : []));
}

function categoryNames(row: Pick<PublishedRow, "category_ids" | "primary_category_id">, taxonomy: PublicTaxonomy) {
  return categoryTerms(row, taxonomy).map((term) => term.name);
}

export function toArticle(row: PublishedRow, taxonomy: PublicTaxonomy, imageUrl: ImageUrl): ArticleData {
  const guide = row.type === "guide";
  const sections = guide && Array.isArray(row.sections) ? row.sections : [];
  const prerequisites = Array.isArray(row.prerequisites) ? row.prerequisites : [];
  return {
    type: asContentType(row.type),
    title: row.title,
    summary: row.summary,
    cover: coverImage(row, imageUrl),
    authors: row.author_ids.flatMap((id) => {
      const author = taxonomy.authors[id];
      return author
        ? [
            {
              name: author.name,
              roleTitle: author.roleTitle,
              avatarUrl: author.avatarKey ? imageUrl(author.avatarKey) : null,
            },
          ]
        : [];
    }),
    categories: categoryNames(row, taxonomy),
    tags: row.tag_ids.flatMap((id) => (taxonomy.tags[id] ? [taxonomy.tags[id].name] : [])),
    readingMinutes: row.reading_time_minutes,
    publishedAt: row.first_published_at,
    updatedAt: row.content_updated_at,
    difficulty: guide ? asDifficulty(row.difficulty) : null,
    estimatedMinutes: guide ? row.estimated_minutes : null,
    prerequisites: guide
      ? prerequisites.flatMap((item) => (isRecord(item) && typeof item.text === "string" ? [item.text] : []))
      : [],
    body: asDoc(row.body),
    sections: sections.flatMap((section) =>
      isRecord(section)
        ? [
            {
              title: typeof section.title === "string" ? section.title : "",
              anchor: typeof section.anchor === "string" ? section.anchor : null,
              body: asDoc(section.body),
            },
          ]
        : [],
    ),
  };
}

export function toCard(row: PublishedCardRow, taxonomy: PublicTaxonomy, imageUrl: ImageUrl): ContentCard {
  const type = asContentType(row.type);
  const guide = type === "guide";
  const categories = categoryTerms(row, taxonomy);
  return {
    id: row.content_id,
    type,
    path: contentPath(type, row.slug),
    title: row.title,
    excerpt: row.excerpt,
    cover: coverImage(row, imageUrl),
    category: row.primary_category_id ? (taxonomy.categories[row.primary_category_id] ?? null) : null,
    categories,
    tags: (row.tag_ids ?? []).flatMap((id) => (taxonomy.tags[id] ? [taxonomy.tags[id]] : [])),
    authors: row.author_ids.flatMap((id) => (taxonomy.authors[id] ? [taxonomy.authors[id].name] : [])),
    readingMinutes: row.reading_time_minutes,
    difficulty: guide ? asDifficulty(row.difficulty) : null,
    estimatedMinutes: guide ? (row.estimated_minutes ?? null) : null,
    prerequisiteCount: guide && Array.isArray(row.prerequisites) ? row.prerequisites.length : 0,
    featured: row.is_featured === true,
    pinnedRank: row.pinned_rank ?? null,
    publishedAt: row.first_published_at,
  };
}

/** Cards in the order the ids were given (related posts are hand-ordered). Missing ones are skipped. */
export function inOrder<T extends { id: string }>(ids: string[], items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

type TopicFields = Pick<PublishedCardRow, "content_id" | "type" | "primary_category_id" | "category_ids" | "tag_ids" | "first_published_at">;

/**
 * Posts and guides that share a topic with `row`, best match first: the same
 * primary category counts most, then each shared tag, then each shared
 * category. Nothing in common means not related. Ties go to the same type,
 * then the newest.
 */
export function relatedByTopic<T extends TopicFields>(row: TopicFields, candidates: T[], skip: string[] = []): T[] {
  const skipped = new Set([row.content_id, ...skip]);
  const tags = new Set(row.tag_ids ?? []);
  const categories = new Set(row.category_ids ?? []);
  const scored = candidates.flatMap((candidate) => {
    if (skipped.has(candidate.content_id)) return [];
    let score = 0;
    if (row.primary_category_id && candidate.primary_category_id === row.primary_category_id) score += 3;
    for (const id of candidate.tag_ids ?? []) if (tags.has(id)) score += 2;
    for (const id of candidate.category_ids ?? []) if (categories.has(id)) score += 1;
    return score > 0 ? [{ candidate, score, sameType: candidate.type === row.type }] : [];
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.sameType) - Number(a.sameType) ||
      (b.candidate.first_published_at ?? "").localeCompare(a.candidate.first_published_at ?? ""),
  );
  return scored.map((entry) => entry.candidate);
}

/** Title, description and canonical for generateMetadata. */
export function articleMeta(row: PublishedRow, absoluteUrl: (path: string) => string) {
  const path = contentPath(asContentType(row.type), row.slug);
  return {
    title: row.seo_title?.trim() || row.title,
    description: row.seo_description?.trim() || row.excerpt?.trim() || row.summary?.trim() || undefined,
    canonical: row.canonical_url || absoluteUrl(path),
    noindex: row.noindex,
    path,
  };
}

/** The image a share card or JSON-LD should use: the OG upload, else the cover. */
export function shareImage(row: Pick<PublishedRow, "og_image" | "cover" | "assets">): PublishedAsset | null {
  const assets = publishedAssets(row.assets);
  return referencedAsset(row.og_image, assets) ?? referencedAsset(row.cover, assets);
}

const PROFICIENCY: Record<string, string> = { beginner: "Beginner", advanced: "Expert" };

/**
 * BlogPosting for blog posts, TechArticle for guides. The summary is the
 * description: it is the answer-first text the page leads with, so the
 * schema and the page say the same thing.
 */
export function articleSchema(
  row: PublishedRow,
  taxonomy: PublicTaxonomy,
  urls: { absoluteUrl: (path: string) => string; imageUrl: ImageUrl },
): Record<string, unknown> {
  const meta = articleMeta(row, urls.absoluteUrl);
  const url = urls.absoluteUrl(meta.path);
  const image = shareImage(row);
  const guide = row.type === "guide";
  const categories = categoryNames(row, taxonomy);
  const tags = row.tag_ids.flatMap((id) => (taxonomy.tags[id] ? [taxonomy.tags[id].name] : []));
  return {
    "@context": "https://schema.org",
    "@type": guide ? "TechArticle" : "BlogPosting",
    "@id": `${url}#article`,
    headline: row.title.slice(0, 110),
    description: row.summary?.trim() || meta.description,
    url,
    mainEntityOfPage: url,
    inLanguage: "en",
    datePublished: row.first_published_at,
    dateModified: row.content_updated_at,
    ...(image ? { image: [urls.imageUrl(image.key)] } : {}),
    author: row.author_ids.flatMap((id) => {
      const author = taxonomy.authors[id];
      return author
        ? [{ "@type": "Person", name: author.name, ...(author.sameAs.length ? { sameAs: author.sameAs } : {}) }]
        : [];
    }),
    publisher: { "@id": urls.absoluteUrl("/#organization") },
    isPartOf: { "@id": urls.absoluteUrl("/#website") },
    ...(categories[0] ? { articleSection: categories[0] } : {}),
    ...(tags.length ? { keywords: tags.join(", ") } : {}),
    wordCount: row.word_count,
    ...(guide && row.difficulty && PROFICIENCY[row.difficulty]
      ? { proficiencyLevel: PROFICIENCY[row.difficulty] }
      : {}),
    ...(guide && row.estimated_minutes ? { timeRequired: `PT${row.estimated_minutes}M` } : {}),
  };
}

/** Home > Blog (or Guides) > the post. */
export function articleBreadcrumbSchema(
  row: Pick<PublishedRow, "type" | "slug" | "title">,
  absoluteUrl: (path: string) => string,
): Record<string, unknown> {
  const type = asContentType(row.type);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: type === "guide" ? "Guides" : "Blog",
        item: absoluteUrl(contentIndexPath(type)),
      },
      { "@type": "ListItem", position: 3, name: row.title, item: absoluteUrl(contentPath(type, row.slug)) },
    ],
  };
}

/**
 * A title as the share card's two lines, split near the middle on a space.
 * Long titles are cut at a word with an ellipsis so the card never wraps
 * into a third line.
 */
export function splitTitle(title: string, maxLine = 30): [string, string] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["Untitled", ""];
  if (words.length === 1) return [words[0]!.slice(0, maxLine), ""];
  let best = 1;
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const gap = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  const fit = (line: string) => {
    if (line.length <= maxLine) return line;
    const cut = line.slice(0, maxLine - 1);
    const space = cut.lastIndexOf(" ");
    return `${(space > maxLine / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
  };
  return [fit(words.slice(0, best).join(" ")), fit(words.slice(best).join(" "))];
}

/** https links from an author's social_links, for sameAs. */
export function authorSameAs(value: unknown): string[] {
  if (!isRecord(value)) return [];
  return Object.values(value).filter(
    (link): link is string => typeof link === "string" && /^https:\/\/[^\s]+$/.test(link),
  );
}
