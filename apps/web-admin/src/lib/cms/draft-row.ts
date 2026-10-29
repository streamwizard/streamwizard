import { migrateDoc, type Doc } from "@repo/cms";
import type { getCmsContentForEditor } from "@repo/supabase/queries/cms/content";
import type { ContentDraft, ContentType, Difficulty } from "./draft";

// Server-only: the editor's starting state from the working copy row.

export type EditorRow = NonNullable<Awaited<ReturnType<typeof getCmsContentForEditor>>["data"]>;

const asDoc = (value: unknown): Doc => migrateDoc(value).doc;

/**
 * A body written by a newer deploy than this one. The editor would save it
 * back at this deploy's version and quietly drop whatever it couldn't read.
 */
export function rowHasFutureBody(row: EditorRow): boolean {
  return migrateDoc(row.body).future || row.sections.some((section) => migrateDoc(section.body).future);
}

export function draftFromRow(row: EditorRow): ContentDraft {
  const prerequisites = Array.isArray(row.prerequisites) ? row.prerequisites : [];
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    summary: row.summary ?? "",
    coverAssetId: row.cover_asset_id,
    body: asDoc(row.body),
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    ogAssetId: row.og_asset_id,
    canonicalUrl: row.canonical_url ?? "",
    noindex: row.noindex,
    primaryCategoryId: row.primary_category_id,
    isFeatured: row.is_featured,
    pinnedRank: row.pinned_rank,
    commentsEnabled: row.comments_enabled,
    difficulty: (row.difficulty as Difficulty | null) ?? null,
    estimatedMinutes: row.estimated_minutes,
    prerequisites: prerequisites.flatMap((item) =>
      item && typeof item === "object" && "text" in item && typeof item.text === "string" ? [item.text] : [],
    ),
    sections: [...row.sections]
      .sort((a, b) => a.position - b.position)
      .map((section) => ({ id: section.id, title: section.title, anchor: section.anchor, body: asDoc(section.body) })),
    authorIds: [...row.credits].sort((a, b) => a.position - b.position).map((credit) => credit.author_id),
    categoryIds: row.categories.map((category) => category.category_id),
    tagIds: row.tags.map((tag) => tag.tag_id),
    relatedIds: [...row.related].sort((a, b) => a.position - b.position).map((related) => related.related_id),
  };
}

export function contentType(row: EditorRow): ContentType {
  return row.type === "guide" ? "guide" : "blog";
}
