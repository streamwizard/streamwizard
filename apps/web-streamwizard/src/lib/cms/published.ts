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
  | "author_ids"
  | "primary_category_id"
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

export interface ContentCard {
  id: string;
  type: ContentType;
  path: string;
  title: string;
  excerpt: string | null;
  cover: { src: string; width: number | null; height: number | null; alt: string } | null;
  category: string | null;
  authors: string[];
  readingMinutes: number;
  difficulty: ArticleData["difficulty"];
  publishedAt: string;
}

type ImageUrl = (key: string) => string;

const DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);

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

/** Category names with the primary one first. */
function categoryNames(row: Pick<PublishedRow, "category_ids" | "primary_category_id">, taxonomy: PublicTaxonomy) {
  const ids = row.primary_category_id
    ? [row.primary_category_id, ...row.category_ids.filter((id) => id !== row.primary_category_id)]
    : row.category_ids;
  return ids.flatMap((id) => (taxonomy.categories[id] ? [taxonomy.categories[id].name] : []));
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
        ? [{ title: typeof section.title === "string" ? section.title : "", body: asDoc(section.body) }]
        : [],
    ),
  };
}

export function toCard(row: PublishedCardRow, taxonomy: PublicTaxonomy, imageUrl: ImageUrl): ContentCard {
  const type = asContentType(row.type);
  return {
    id: row.content_id,
    type,
    path: contentPath(type, row.slug),
    title: row.title,
    excerpt: row.excerpt,
    cover: coverImage(row, imageUrl),
    category: row.primary_category_id ? (taxonomy.categories[row.primary_category_id]?.name ?? null) : null,
    authors: row.author_ids.flatMap((id) => (taxonomy.authors[id] ? [taxonomy.authors[id].name] : [])),
    readingMinutes: row.reading_time_minutes,
    difficulty: type === "guide" ? asDifficulty(row.difficulty) : null,
    publishedAt: row.first_published_at,
  };
}

/** Cards in the order the ids were given (related posts are hand-ordered). Missing ones are skipped. */
export function inOrder<T extends { id: string }>(ids: string[], items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
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
