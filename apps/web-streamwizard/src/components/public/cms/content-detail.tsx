import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { contentPath, isValidSlug, type ContentType } from "@repo/cms";
import type { ContentProps } from "@repo/posthog";
import { JsonLd } from "@/components/seo/json-ld";
import { cmsImageUrl, imageResolver } from "@/lib/cms/images";
import {
  getCurrentSlug,
  getPublicTaxonomy,
  getPublishedPost,
  listPostsById,
  listPublishedPosts,
} from "@/lib/cms/public";
import {
  articleBreadcrumbSchema,
  articleMeta,
  articleSchema,
  inOrder,
  publishedAssets,
  relatedByTopic,
  toArticle,
  toCard,
  type PublicTaxonomy,
  type PublishedCardRow,
  type PublishedRow,
} from "@/lib/cms/published";
import { absoluteUrl } from "@/lib/seo";
import { CmsArticle } from "./cms-article";
import { ContentCard } from "./content-card";
import { ContentTracker } from "./content-tracker";

// /blog/[slug] and /guides/[slug]. A slug that used to belong to a post
// redirects (308) to where it lives now; anything else that isn't live is a
// 404, archived posts included.

type Params = Promise<{ slug: string }>;

const RELATED_COUNT = 3;

/** The live post at this URL, a redirect to its new one, or a 404. */
async function loadPost(type: ContentType, slug: string): Promise<PublishedRow> {
  if (!isValidSlug(slug)) notFound();
  const row = await getPublishedPost(type, slug);
  if (row) return row;
  const current = await getCurrentSlug(type, slug);
  if (current && current !== slug) permanentRedirect(contentPath(type, current));
  notFound();
}

// What the head says when there's no live post here. A not-found.tsx below
// the root can't set metadata, so the page does it. `robots: null` for the
// same reason as in app/not-found.tsx: Next adds its own noindex on a 404.
const NOT_FOUND_METADATA: Metadata = { title: "Page not found", robots: null };

export async function contentMetadata(type: ContentType, params: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return NOT_FOUND_METADATA;
  const row = await getPublishedPost(type, slug);
  if (!row) return NOT_FOUND_METADATA;
  const meta = articleMeta(row, absoluteUrl);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    ...(meta.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

function trackingProps(row: PublishedRow, taxonomy: PublicTaxonomy): ContentProps {
  const slugsOf = (ids: string[], from: Record<string, { slug: string }>) =>
    ids.flatMap((id) => (from[id] ? [from[id].slug] : []));
  const difficulty = row.difficulty as ContentProps["difficulty"];
  return {
    content_type: row.type === "guide" ? "guide" : "blog",
    content_id: row.content_id,
    slug: row.slug,
    category: row.primary_category_id ? (taxonomy.categories[row.primary_category_id]?.slug ?? null) : null,
    categories: slugsOf(row.category_ids, taxonomy.categories),
    tags: slugsOf(row.tag_ids, taxonomy.tags),
    authors: slugsOf(row.author_ids, taxonomy.authors),
    reading_time_minutes: row.reading_time_minutes,
    word_count: row.word_count,
    difficulty: row.type === "guide" ? (difficulty ?? null) : null,
  };
}

export async function ContentDetail({ type, params }: { type: ContentType; params: Params }) {
  const { slug } = await params;
  const row = await loadPost(type, slug);
  const [taxonomy, relatedRows, blogs, guides] = await Promise.all([
    getPublicTaxonomy(),
    listPostsById(row.related_ids),
    listPublishedPosts("blog"),
    listPublishedPosts("guide"),
  ]);
  // Hand-picked related posts first, then the closest topic matches to fill.
  const card = (published: PublishedCardRow) => toCard(published, taxonomy, cmsImageUrl);
  const related = [
    ...inOrder(row.related_ids, relatedRows.map(card)),
    ...relatedByTopic(row, [...blogs, ...guides], row.related_ids)
      .slice(0, RELATED_COUNT)
      .map(card),
  ].slice(0, RELATED_COUNT);
  const host = ((await headers()).get("host") ?? "streamwizard.org").replace(/:\d+$/, "");

  return (
    <div className="bg-background text-foreground">
      <JsonLd schema={articleSchema(row, taxonomy, { absoluteUrl, imageUrl: cmsImageUrl })} />
      <JsonLd schema={articleBreadcrumbSchema(row, absoluteUrl)} />
      <CmsArticle
        data={toArticle(row, taxonomy, cmsImageUrl)}
        resolveImage={imageResolver(publishedAssets(row.assets))}
        parentHost={host}
        related={related.map((item) => ({ title: item.title, path: item.path, type: item.type }))}
      />
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <h2 id="related-heading" className="border-t border-border pt-12 text-2xl font-semibold tracking-tight">
            Read next
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id} className="flex">
                <ContentCard card={item} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <ContentTracker content={trackingProps(row, taxonomy)} />
    </div>
  );
}
