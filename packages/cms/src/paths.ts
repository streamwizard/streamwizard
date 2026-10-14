import type { ContentType } from "./tags";

// Public URLs of posts and guides. The site's routes, web-admin's "View on
// site" links and the log channel all build them here, so they can't drift.

export const CONTENT_BASE_PATHS: Record<ContentType, string> = { blog: "/blog", guide: "/guides" };

export function contentIndexPath(type: ContentType): string {
  return CONTENT_BASE_PATHS[type];
}

export function contentPath(type: ContentType, slug: string): string {
  return `${CONTENT_BASE_PATHS[type]}/${encodeURIComponent(slug)}`;
}
