import { z } from "zod";
import {
  AnchorRegistry,
  EMPTY_DOC,
  extractText,
  extractToc,
  readingStats,
  sanitizeDoc,
  slugify,
  type Doc,
  type SanitizeIssue,
  type TocEntry,
} from "@repo/cms";

// The editor's draft of a post or guide, and how it turns into what the
// database stores. Pure: the editor uses it for the live reading time and
// table of contents, the save action uses it to build the cms_save_draft call.

export type ContentType = "blog" | "guide";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export const DIFFICULTIES: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export interface DraftSection {
  /** Made in the browser for a new section, so it stays the same across saves. */
  id: string;
  title: string;
  body: Doc;
}

export interface ContentDraft {
  title: string;
  slug: string;
  excerpt: string;
  summary: string;
  coverAssetId: string | null;
  body: Doc;
  seoTitle: string;
  seoDescription: string;
  ogAssetId: string | null;
  canonicalUrl: string;
  noindex: boolean;
  primaryCategoryId: string | null;
  isFeatured: boolean;
  pinnedRank: number | null;
  commentsEnabled: boolean;
  difficulty: Difficulty | null;
  estimatedMinutes: number | null;
  prerequisites: string[];
  sections: DraftSection[];
  authorIds: string[];
  categoryIds: string[];
  tagIds: string[];
  relatedIds: string[];
}

export const LIMITS = {
  title: 200,
  excerpt: 300,
  summary: 400,
  seoTitle: 120,
  seoDescription: 300,
  sectionTitle: 200,
  sections: 50,
  prerequisites: 20,
  prerequisite: 200,
} as const;

const uuid = z.string().uuid();
const text = (max: number) => z.string().max(max);

/** What the save action accepts. Bodies are checked by sanitizeDoc, not here. */
export const draftSchema = z.object({
  title: text(LIMITS.title),
  slug: z.string().max(80),
  excerpt: text(LIMITS.excerpt),
  summary: text(LIMITS.summary),
  coverAssetId: uuid.nullable(),
  body: z.unknown(),
  seoTitle: text(LIMITS.seoTitle),
  seoDescription: text(LIMITS.seoDescription),
  ogAssetId: uuid.nullable(),
  canonicalUrl: z.string().max(2048),
  noindex: z.boolean(),
  primaryCategoryId: uuid.nullable(),
  isFeatured: z.boolean(),
  pinnedRank: z.number().int().min(0).max(999).nullable(),
  commentsEnabled: z.boolean(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  estimatedMinutes: z.number().int().min(1).max(10_000).nullable(),
  prerequisites: z.array(text(LIMITS.prerequisite)).max(LIMITS.prerequisites),
  sections: z
    .array(z.object({ id: uuid, title: text(LIMITS.sectionTitle), body: z.unknown() }))
    .max(LIMITS.sections, `A guide can have up to ${LIMITS.sections} sections.`),
  authorIds: z.array(uuid).max(10),
  categoryIds: z.array(uuid).max(10),
  tagIds: z.array(uuid).max(30),
  relatedIds: z.array(uuid).max(10),
});

export function emptyDoc(): Doc {
  return { ...EMPTY_DOC, content: [] };
}

export interface DerivedDraft {
  /** cms_content columns for cms_save_draft's p_fields. */
  fields: Record<string, unknown>;
  /** null for blog posts: they have no sections. */
  sections: { id: string; title: string; anchor: string; body: Doc; body_text: string }[] | null;
  toc: TocEntry[];
  words: number;
  minutes: number;
  /** What sanitizeDoc removed, per doc ("body" or the section index). */
  removed: { where: "body" | number; issues: SanitizeIssue[] }[];
}

const blankToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * Cleans the bodies and works out everything stored alongside them. A guide's
 * table of contents is the intro's headings, then each section (as an H2)
 * followed by its own headings; anchors are unique across the whole page.
 */
export function deriveDraft(type: ContentType, draft: ContentDraft): DerivedDraft {
  const removed: DerivedDraft["removed"] = [];
  const body = sanitizeDoc(draft.body);
  if (body.issues.length) removed.push({ where: "body", issues: body.issues });

  const anchors = new AnchorRegistry();
  const toc = extractToc(body.doc, anchors);
  const docs: Doc[] = [body.doc];

  let sections: DerivedDraft["sections"] = null;
  if (type === "guide") {
    sections = draft.sections.map((section, index) => {
      const clean = sanitizeDoc(section.body);
      if (clean.issues.length) removed.push({ where: index, issues: clean.issues });
      const title = section.title.trim();
      const anchor = anchors.claim(title || `section ${index + 1}`);
      toc.push({ level: 2, text: title, anchor });
      toc.push(...extractToc(clean.doc, anchors));
      docs.push(clean.doc);
      return { id: section.id, title, anchor, body: clean.doc, body_text: extractText(clean.doc) };
    });
  }

  const stats = readingStats(docs);
  const guide = type === "guide";

  return {
    fields: {
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      excerpt: blankToNull(draft.excerpt),
      summary: blankToNull(draft.summary),
      cover_asset_id: draft.coverAssetId,
      body: body.doc,
      body_text: extractText(body.doc),
      toc,
      word_count: stats.words,
      reading_time_minutes: stats.minutes,
      seo_title: blankToNull(draft.seoTitle),
      seo_description: blankToNull(draft.seoDescription),
      og_asset_id: draft.ogAssetId,
      canonical_url: blankToNull(draft.canonicalUrl),
      noindex: draft.noindex,
      primary_category_id:
        draft.primaryCategoryId && draft.categoryIds.includes(draft.primaryCategoryId) ? draft.primaryCategoryId : null,
      is_featured: draft.isFeatured,
      pinned_rank: draft.pinnedRank,
      comments_enabled: draft.commentsEnabled,
      difficulty: guide ? draft.difficulty : null,
      estimated_minutes: guide ? draft.estimatedMinutes : null,
      prerequisites: guide
        ? draft.prerequisites
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => ({ text: item }))
        : [],
    },
    sections,
    toc,
    words: stats.words,
    minutes: stats.minutes,
    removed,
  };
}

/** A slug for a title, or a placeholder while there is no title yet. */
export function slugForTitle(title: string, fallback: string): string {
  return slugify(title) || fallback;
}

/** The canonical URL must be https, if set at all. */
export function canonicalProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && !/\s/.test(trimmed) ? null : "The canonical URL has to start with https://.";
  } catch {
    return "The canonical URL isn't a full URL.";
  }
}
