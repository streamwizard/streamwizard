import type { MetadataRoute } from "next";
import { DISALLOWED_PATHS, absoluteUrl, isIndexableEnvironment } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Staging sits behind Cloudflare Access, so this is defence in depth rather
  // than the actual gate — but it keeps preview hosts out of the index if the
  // Access policy is ever loosened.
  if (!isIndexableEnvironment()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
