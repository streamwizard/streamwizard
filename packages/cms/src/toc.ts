import { inlineText, walk, type Doc } from "./doc";
import { isValidSlug, slugify } from "./slug";

export interface TocEntry {
  level: number;
  text: string;
  anchor: string;
}

// Hands out anchors that are unique within one page: "setup", "setup-2", ...
// A guide shares one across its body and every section, since they all end
// up on the same page.
export class AnchorRegistry {
  private readonly taken = new Set<string>();

  /**
   * `preferred` is the anchor the heading already carries. It wins when it is
   * a usable slug and nothing else on the page took it, so rewording a
   * heading doesn't move it.
   */
  claim(text: string, preferred?: string | null): string {
    if (preferred && isValidSlug(preferred) && !this.taken.has(preferred)) {
      this.taken.add(preferred);
      return preferred;
    }
    const base = slugify(text, 60) || "section";
    let anchor = base;
    for (let n = 2; this.taken.has(anchor); n++) anchor = `${base}-${n}`;
    this.taken.add(anchor);
    return anchor;
  }
}

// Every heading in document order with the anchor it gets on the page. The
// renderer calls this too and assigns anchors by position, so the table of
// contents and the heading ids can never disagree.
export function extractToc(doc: Doc, anchors: AnchorRegistry = new AnchorRegistry()): TocEntry[] {
  const entries: TocEntry[] = [];
  walk(doc, (node) => {
    if (node.type !== "heading") return;
    const text = inlineText(node).trim();
    const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
    const preferred = typeof node.attrs?.anchor === "string" ? node.attrs.anchor : null;
    entries.push({ level, text, anchor: anchors.claim(text, preferred) });
  });
  return entries;
}

export interface PageOutline {
  /** Every heading on the page, in order: the table of contents. */
  toc: TocEntry[];
  /** Anchors of the body's headings, in document order. */
  bodyAnchors: string[];
  /** Per guide section: its own anchor (an H2 on the page), then its headings'. */
  sections: { anchor: string; headingAnchors: string[] }[];
}

/**
 * The one place anchors are handed out for a whole page. The editor stores
 * what this returns, and the renderer calls it again on the same content, so
 * heading ids and table-of-contents links always agree.
 */
export function pageOutline(
  body: Doc,
  sections: readonly { title: string; body: Doc; anchor?: string | null }[] = [],
): PageOutline {
  const anchors = new AnchorRegistry();
  const bodyToc = extractToc(body, anchors);
  const toc = [...bodyToc];
  const outline = sections.map((section, index) => {
    const title = section.title.trim();
    const anchor = anchors.claim(title || `section ${index + 1}`, section.anchor ?? null);
    const headings = extractToc(section.body, anchors);
    toc.push({ level: 2, text: title, anchor }, ...headings);
    return { anchor, headingAnchors: headings.map((entry) => entry.anchor) };
  });
  return { toc, bodyAnchors: bodyToc.map((entry) => entry.anchor), sections: outline };
}
