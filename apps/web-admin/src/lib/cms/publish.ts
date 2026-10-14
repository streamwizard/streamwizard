import { contentPath, type ContentType } from "@repo/cms";
import type { ReadinessItem } from "./readiness";

// Pure helpers for the publish actions: what to tell the admin when the
// server-side check finds something, and where a post lives on the site.

/** Null when nothing blocks publishing, else one toast-sized sentence. */
export function blockingMessage(items: ReadinessItem[]): string | null {
  const errors = items.filter((item) => item.severity === "error");
  if (errors.length === 0) return null;
  const first = errors[0]!;
  const where = first.section !== undefined ? `Section ${first.section + 1}: ` : "";
  const rest = errors.length - 1;
  return `${where}${first.message}${rest > 0 ? ` Plus ${rest} more on the Checks tab.` : ""}`;
}

/** The post's public URL, or null when this environment has no site URL. */
export function publicContentUrl(siteUrl: string | undefined, type: ContentType, slug: string): string | null {
  if (!siteUrl) return null;
  try {
    return new URL(contentPath(type, slug), siteUrl).toString();
  } catch {
    return null;
  }
}
