// Pure helpers behind the article read tracker (content-tracker.tsx).

export const READ_DEPTHS = [25, 50, 75, 100] as const;
export type ReadDepth = (typeof READ_DEPTHS)[number];

/**
 * How far through the body the reader is, as the depths passed: the share of
 * the body above the bottom of the viewport. A body shorter than the screen
 * counts as fully read once it's all in view.
 */
export function depthsPassed(bodyTop: number, bodyHeight: number, viewportHeight: number): ReadDepth[] {
  if (bodyHeight <= 0) return [];
  const read = Math.min(Math.max((viewportHeight - bodyTop) / bodyHeight, 0), 1);
  return READ_DEPTHS.filter((depth) => read * 100 >= depth);
}

export interface LinkTarget {
  link_type: "internal" | "external";
  /** Path for our own pages, host for anyone else's. Never a full URL or query string. */
  target: string;
}

/** Null for in-page anchors (the TOC) and anything that isn't a web or mail link. */
export function classifyLink(href: string, pageUrl: string): LinkTarget | null {
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  const page = new URL(pageUrl);
  if (url.protocol === "mailto:") return { link_type: "external", target: "mailto" };
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.host === page.host) {
    if (url.pathname === page.pathname && url.hash) return null;
    return { link_type: "internal", target: url.pathname };
  }
  return { link_type: "external", target: url.hostname };
}
