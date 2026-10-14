import { inlineText, walk, type Doc } from "./doc";
import { slugify } from "./slug";

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

  claim(text: string): string {
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
    entries.push({ level, text, anchor: anchors.claim(text) });
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
export function pageOutline(body: Doc, sections: readonly { title: string; body: Doc }[] = []): PageOutline {
  const anchors = new AnchorRegistry();
  const bodyToc = extractToc(body, anchors);
  const toc = [...bodyToc];
  const outline = sections.map((section, index) => {
    const title = section.title.trim();
    const anchor = anchors.claim(title || `section ${index + 1}`);
    const headings = extractToc(section.body, anchors);
    toc.push({ level: 2, text: title, anchor }, ...headings);
    return { anchor, headingAnchors: headings.map((entry) => entry.anchor) };
  });
  return { toc, bodyAnchors: bodyToc.map((entry) => entry.anchor), sections: outline };
}
