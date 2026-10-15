import type { MetadataRoute } from "next";
import { contentIndexPath, contentPath } from "@repo/cms";
import { reportError } from "@repo/sentry";
import { listSitemapEntries } from "@/lib/cms/public";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

// Rendered per request: the posts must not be frozen at build time. The post list itself is cached (lib/cms/public.ts), so this is cheap.
export const dynamic = "force-dynamic";

/**
 * The hand-listed public routes, plus the blog, the guides and every
 * published post. A database hiccup drops the posts for this request rather
 * than the whole sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(route.lastModified),
  }));
  try {
    const entries = await listSitemapEntries();
    // ISO timestamps sort as strings.
    const newest = (type: "blog" | "guide") =>
      entries
        .filter((entry) => entry.type === type)
        .map((entry) => entry.lastModified)
        .sort()
        .at(-1);
    for (const type of ["blog", "guide"] as const) {
      const lastModified = newest(type);
      routes.push({
        url: absoluteUrl(contentIndexPath(type)),
        ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
      });
    }
    for (const entry of entries) {
      routes.push({
        url: absoluteUrl(contentPath(entry.type, entry.slug)),
        lastModified: new Date(entry.lastModified),
      });
    }
  } catch (error) {
    reportError(error, "cms: sitemap");
  }
  return routes;
}
