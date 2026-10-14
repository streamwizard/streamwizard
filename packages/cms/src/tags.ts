// Cache tags for the public site. Every cached CMS read carries the tags of
// everything it shows, and every change refreshes the tags tagsForChange
// returns. A cached "related posts" or list entry is tagged with each post it
// contains, so changing one post refreshes every place it appears without a
// reverse lookup.

export type ContentType = "blog" | "guide";

export const cmsTags = {
  // Everything. For an emergency flush, never for a normal change.
  all: "cms",
  content: (id: string) => `cms:content:${id}`,
  list: (type: ContentType) => `cms:list:${type}`,
  // Feeds and pages that mix both types.
  listAll: "cms:list:all",
  category: (id: string) => `cms:category:${id}`,
  tag: (id: string) => `cms:tag:${id}`,
  author: (id: string) => `cms:author:${id}`,
  // Names and slugs of categories, tags and authors.
  taxonomy: "cms:taxonomy",
  sitemap: "cms:sitemap",
  comments: (contentId: string) => `cms:comments:${contentId}`,
} as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CMS_TAG = new RegExp(
  `^cms(?::(?:list:(?:blog|guide|all)|taxonomy|sitemap|(?:content|category|tag|author|comments):${UUID}))?$`,
);

// The revalidate endpoint refuses anything else, so a leaked secret can't be
// used to flush unrelated caches.
export function isCmsTag(tag: string): boolean {
  return CMS_TAG.test(tag);
}

// What a post looks like on the public site: enough to know which pages show it.
export interface PublicFootprint {
  id: string;
  type: ContentType;
  categoryIds: readonly string[];
  tagIds: readonly string[];
  authorIds: readonly string[];
}

// The tags to refresh when a post goes from `before` to `after` on the public
// site (null = not public). Both sides count: a post that leaves a category
// must disappear from that category's page, a post that joins one must appear.
export function tagsForChange(before: PublicFootprint | null, after: PublicFootprint | null): string[] {
  if (!before && !after) return [];
  const tags = new Set<string>([cmsTags.listAll, cmsTags.sitemap]);
  for (const side of [before, after]) {
    if (!side) continue;
    tags.add(cmsTags.content(side.id));
    tags.add(cmsTags.list(side.type));
    for (const id of side.categoryIds) tags.add(cmsTags.category(id));
    for (const id of side.tagIds) tags.add(cmsTags.tag(id));
    for (const id of side.authorIds) tags.add(cmsTags.author(id));
  }
  return [...tags];
}
