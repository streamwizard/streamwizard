import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/**
 * The public site's reads: published posts and guides (cms_content_published,
 * the copy cms_publish writes), their old slugs, and the authors, categories
 * and tags they point at. Everything here works with the anon client, so the
 * site can call it inside unstable_cache (no cookies there).
 */

type DBClient = SupabaseClient<Database>;
export type CmsPublishedType = "blog" | "guide";

/** Everything a detail page renders. Not `search`: the tsvector is for queries only. */
const DETAIL_COLUMNS =
  "content_id, type, slug, title, excerpt, summary, cover, og_image, body, sections, toc, assets, word_count, reading_time_minutes, seo_title, seo_description, canonical_url, noindex, difficulty, estimated_minutes, prerequisites, author_ids, category_ids, tag_ids, related_ids, primary_category_id, is_featured, pinned_rank, comments_enabled, first_published_at, content_updated_at";

/** Enough for a card and the index filters: no body. `assets` carries the cover's key and size. */
const CARD_COLUMNS =
  "content_id, type, slug, title, excerpt, cover, assets, reading_time_minutes, difficulty, estimated_minutes, prerequisites, author_ids, category_ids, tag_ids, primary_category_id, is_featured, pinned_rank, first_published_at, content_updated_at";

export const getPublishedCmsContent = withMetrics(
  "cms_content_published",
  "select",
  async (client: DBClient, type: CmsPublishedType, slug: string) =>
    client.from("cms_content_published").select(DETAIL_COLUMNS).eq("type", type).eq("slug", slug).maybeSingle(),
);

/** Where an old slug points now: the post's current slug, or null. */
export const getCmsSlugRedirect = withMetrics(
  "cms_slug_redirects",
  "select",
  async (
    client: DBClient,
    type: CmsPublishedType,
    slug: string,
  ): Promise<{ data: { type: string; slug: string } | null; error: Error | null }> => {
    const redirect = await client
      .from("cms_slug_redirects")
      .select("content_id")
      .eq("type", type)
      .eq("old_slug", slug)
      .maybeSingle();
    if (redirect.error || !redirect.data) return { data: null, error: redirect.error };
    const current = await client
      .from("cms_content_published")
      .select("type, slug")
      .eq("content_id", redirect.data.content_id)
      .maybeSingle();
    return { data: current.data, error: current.error };
  },
);

/** One type's index: pinned first (by rank), then newest. */
export const listPublishedCmsContent = withMetrics(
  "cms_content_published",
  "select",
  async (client: DBClient, type: CmsPublishedType, limit: number) =>
    client
      .from("cms_content_published")
      .select(CARD_COLUMNS)
      .eq("type", type)
      .order("pinned_rank", { ascending: true, nullsFirst: false })
      .order("first_published_at", { ascending: false })
      .limit(limit),
);

/** Cards for a known set of posts (related posts). Order is the caller's. */
export const listPublishedCmsContentByIds = withMetrics(
  "cms_content_published",
  "select",
  async (client: DBClient, ids: string[]) =>
    client.from("cms_content_published").select(CARD_COLUMNS).in("content_id", ids),
);

/** Every published URL, for the sitemap. */
export const listPublishedCmsSitemap = withMetrics("cms_content_published", "select", async (client: DBClient) =>
  client
    .from("cms_content_published")
    .select("type, slug, noindex, canonical_url, content_updated_at")
    .order("first_published_at", { ascending: false })
    .limit(5000),
);

/**
 * Live authors with their avatar. anon has column grants on cms_authors, so
 * the columns are named (select=* is refused).
 */
export const listPublicCmsAuthors = withMetrics("cms_authors", "select", async (client: DBClient) =>
  client
    .from("cms_authors")
    .select("id, slug, name, role_title, bio, social_links, avatar:cms_assets(key, width, height)")
    .is("deleted_at", null)
    .order("name"),
);

export const listPublicCmsCategories = withMetrics("cms_categories", "select", async (client: DBClient) =>
  client.from("cms_categories").select("id, slug, name, description").order("position").order("name"),
);

export const listPublicCmsTags = withMetrics("cms_tags", "select", async (client: DBClient) =>
  client.from("cms_tags").select("id, slug, name").order("name"),
);
