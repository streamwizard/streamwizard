import { hashPreviewToken, isPreviewToken, previewState, toPgBytea, type PreviewState } from "@repo/cms/preview-token";
import type { Doc } from "@repo/cms";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { selectCmsAssetsByIds } from "@repo/supabase/queries/cms/assets";
import { getCmsPreviewByHash } from "@repo/supabase/queries/cms/preview";
import type { ArticleData } from "@/components/public/cms/cms-article";
import { cmsImageUrl, docAssetIds, type AssetRecord } from "./images";

// Server-only. What /preview/[token] shows: the saved draft behind a valid
// link, read with the service role (anon can't see drafts at all).

export type PreviewResult =
  | { state: "missing" }
  | { state: Exclude<PreviewState, "active"> }
  | { state: "active"; article: ArticleData; assets: Map<string, AssetRecord> };

const asDoc = (value: unknown): Doc =>
  value && typeof value === "object" && (value as Doc).type === "doc" ? (value as Doc) : { type: "doc", content: [] };

export async function loadPreview(token: string): Promise<PreviewResult> {
  if (!isPreviewToken(token)) return { state: "missing" };
  const { data, error } = await getCmsPreviewByHash(supabaseAdmin, toPgBytea(hashPreviewToken(token)));
  if (error) throw error;
  const content = data?.content;
  if (!data || !content || content.deleted_at) return { state: "missing" };
  const state = previewState(data);
  if (state !== "active") return { state };

  const guide = content.type === "guide";
  const sections = guide
    ? [...content.sections]
        .sort((a, b) => a.position - b.position)
        .map((section) => ({ title: section.title, body: asDoc(section.body) }))
    : [];
  const body = asDoc(content.body);

  const ids = docAssetIds([body, ...sections.map((section) => section.body)]);
  const assets = new Map<string, AssetRecord>();
  if (ids.length > 0) {
    const { data: rows, error: assetError } = await selectCmsAssetsByIds(supabaseAdmin, ids);
    if (assetError) throw assetError;
    for (const row of rows ?? []) assets.set(row.id, { key: row.key, width: row.width, height: row.height });
  }

  const prerequisites = Array.isArray(content.prerequisites) ? content.prerequisites : [];
  const article: ArticleData = {
    type: guide ? "guide" : "blog",
    title: content.title,
    summary: content.summary,
    cover: content.cover
      ? {
          src: cmsImageUrl(content.cover.key),
          width: content.cover.width,
          height: content.cover.height,
          alt: content.cover.is_decorative ? "" : content.cover.alt,
        }
      : null,
    authors: [...content.credits]
      .sort((a, b) => a.position - b.position)
      .flatMap((credit) =>
        credit.author
          ? [
              {
                name: credit.author.name,
                roleTitle: credit.author.role_title,
                avatarUrl: credit.author.avatar ? cmsImageUrl(credit.author.avatar.key) : null,
              },
            ]
          : [],
      ),
    categories: content.categories.flatMap((link) => (link.category ? [link.category.name] : [])),
    tags: content.tags.flatMap((link) => (link.tag ? [link.tag.name] : [])),
    readingMinutes: content.reading_time_minutes,
    publishedAt: content.first_published_at,
    updatedAt: content.updated_at,
    difficulty: guide ? (content.difficulty as ArticleData["difficulty"]) : null,
    estimatedMinutes: guide ? content.estimated_minutes : null,
    prerequisites: guide
      ? prerequisites.flatMap((item) =>
          item && typeof item === "object" && "text" in item && typeof item.text === "string" ? [item.text] : [],
        )
      : [],
    body,
    sections,
  };
  return { state: "active", article, assets };
}
