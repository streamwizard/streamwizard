import { unstable_cache } from "next/cache";
import { cmsTags, type ContentType } from "@repo/cms";
import { createAnonClient } from "@repo/supabase/anon";
import {
  getCmsSlugRedirect,
  getPublishedCmsContent,
  listPublicCmsAuthors,
  listPublicCmsCategories,
  listPublicCmsTags,
  listPublishedCmsContent,
  listPublishedCmsContentByIds,
  listPublishedCmsSitemap,
} from "@repo/supabase/queries/cms/published";
import { authorSameAs, type PublicTaxonomy, type PublishedCardRow, type PublishedRow } from "./published";

// Server-only. Every read the public blog and guides make, cached per
// container (option A in docs/cms-plan.md): the pages stay dynamic for the
// CSP nonce, the data doesn't hit the database again until a tag it carries
// is refreshed by POST /api/revalidate, or an hour passes.
//
// The tags are fixed when an entry is made, so each read is tagged with what
// it can know up front: a lookup by slug can't know the post's id yet, so it
// carries the list tag of its type (every publish, update or unpublish of
// that type refreshes it). Related cards are looked up by id and carry each
// id's tag.

const HOUR = 3600;
const INDEX_LIMIT = 60;

export const getPublishedPost = (type: ContentType, slug: string) =>
  unstable_cache(
    async (): Promise<PublishedRow | null> => {
      const { data, error } = await getPublishedCmsContent(createAnonClient(), type, slug);
      if (error) throw error;
      return data as PublishedRow | null;
    },
    ["cms-post", type, slug],
    { tags: [cmsTags.all, cmsTags.list(type)], revalidate: HOUR },
  )();

/** The current slug of a post that used to live at `slug`, or null. */
export const getCurrentSlug = (type: ContentType, slug: string) =>
  unstable_cache(
    async (): Promise<string | null> => {
      const { data, error } = await getCmsSlugRedirect(createAnonClient(), type, slug);
      if (error) throw error;
      return data && data.type === type ? data.slug : null;
    },
    ["cms-redirect", type, slug],
    { tags: [cmsTags.all, cmsTags.list(type)], revalidate: HOUR },
  )();

export const listPublishedPosts = (type: ContentType) =>
  unstable_cache(
    async (): Promise<PublishedCardRow[]> => {
      const { data, error } = await listPublishedCmsContent(createAnonClient(), type, INDEX_LIMIT);
      if (error) throw error;
      return (data ?? []) as PublishedCardRow[];
    },
    ["cms-list", type],
    { tags: [cmsTags.all, cmsTags.list(type)], revalidate: HOUR },
  )();

export const listPostsById = (ids: string[]) => {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return Promise.resolve([] as PublishedCardRow[]);
  return unstable_cache(
    async (): Promise<PublishedCardRow[]> => {
      const { data, error } = await listPublishedCmsContentByIds(createAnonClient(), unique);
      if (error) throw error;
      return (data ?? []) as PublishedCardRow[];
    },
    ["cms-by-id", ...unique],
    { tags: [cmsTags.all, ...unique.map((id) => cmsTags.content(id))], revalidate: HOUR },
  )();
};

/** Authors, categories and tags by id. Small, read by every CMS page. */
export const getPublicTaxonomy = unstable_cache(
  async (): Promise<PublicTaxonomy> => {
    const client = createAnonClient();
    const [authors, categories, tags] = await Promise.all([
      listPublicCmsAuthors(client),
      listPublicCmsCategories(client),
      listPublicCmsTags(client),
    ]);
    if (authors.error) throw authors.error;
    if (categories.error) throw categories.error;
    if (tags.error) throw tags.error;
    const taxonomy: PublicTaxonomy = { authors: {}, categories: {}, tags: {} };
    for (const author of authors.data ?? []) {
      const avatar = Array.isArray(author.avatar) ? author.avatar[0] : author.avatar;
      taxonomy.authors[author.id] = {
        id: author.id,
        slug: author.slug,
        name: author.name,
        roleTitle: author.role_title,
        avatarKey: avatar?.key ?? null,
        sameAs: authorSameAs(author.social_links),
      };
    }
    for (const category of categories.data ?? [])
      taxonomy.categories[category.id] = { slug: category.slug, name: category.name };
    for (const tag of tags.data ?? []) taxonomy.tags[tag.id] = { slug: tag.slug, name: tag.name };
    return taxonomy;
  },
  ["cms-taxonomy"],
  { tags: [cmsTags.all, cmsTags.taxonomy], revalidate: HOUR },
);

export interface SitemapEntry {
  type: ContentType;
  slug: string;
  lastModified: string;
}

/** Indexable published posts. A post with its own canonical elsewhere isn't ours to list. */
export const listSitemapEntries = unstable_cache(
  async (): Promise<SitemapEntry[]> => {
    const { data, error } = await listPublishedCmsSitemap(createAnonClient());
    if (error) throw error;
    return (data ?? [])
      .filter((row) => !row.noindex && !row.canonical_url)
      .map((row) => ({
        type: row.type === "guide" ? "guide" : "blog",
        slug: row.slug,
        lastModified: row.content_updated_at,
      }));
  },
  ["cms-sitemap"],
  { tags: [cmsTags.all, cmsTags.sitemap], revalidate: HOUR },
);
