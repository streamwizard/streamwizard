// Clipboard HTML, tidied before the editor parses it.
//
// This is a fidelity pass, NOT a sanitizer. What keeps unwanted markup out of
// the database is, in order: ProseMirror's own parser, the editor schema in
// the admin, and sanitizeDoc on the server. This file exists because by the
// time any of those run, the evidence is gone: Google Docs' bold wrapper,
// Word's mso-* styles and heading levels, and the <img> tags of images we
// can't store are only visible in the clipboard's HTML string.
//
// String in, string out, no DOM, so it can be read and tested like any other
// pure module.

export type PasteSource = "google-docs" | "word" | "html" | "plain";

export interface PasteReport {
  source: PasteSource;
  /** The src of every <img> taken out, in document order. */
  images: string[];
  /** Headings whose level was moved to fit the H2–H4 the page allows. */
  headingsRemapped: number;
  /** Roughly how much junk was thrown away: elements and attributes. */
  stripped: number;
}

/** The page title is the only H1; the body goes from H2 to H4. */
const MIN_LEVEL = 2;
const MAX_LEVEL = 4;

const clamp = (level: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));

/** Where the clipboard came from, from the fingerprints each editor leaves. */
export function detectSource(html: string): PasteSource {
  if (!/<[a-z!/]/i.test(html)) return "plain";
  if (/id=["']?docs-internal-guid-/i.test(html)) return "google-docs";
  if (/urn:schemas-microsoft-com|class=["'][^"']*\bMso|mso-[a-z-]+\s*:/i.test(html)) return "word";
  return "html";
}

/** Code survives a paste as it was written, so it sits out the rest of the pipeline. */
function protectPre(html: string): { html: string; blocks: string[] } {
  const blocks: string[] = [];
  const out = html.replace(/<pre\b[\s\S]*?<\/pre>/gi, (block) => {
    blocks.push(block);
    return `\u0000PRE${blocks.length - 1}\u0000`;
  });
  return { html: out, blocks };
}

function restorePre(html: string, blocks: string[]): string {
  return html.replace(/\u0000PRE(\d+)\u0000/g, (_, index: string) => blocks[Number(index)] ?? "");
}

/** Comments, conditional blocks, and the elements that only carry styling or metadata. */
function removeInvisible(html: string, count: (n: number) => void): string {
  let out = html;
  const drop = (pattern: RegExp) => {
    out = out.replace(pattern, (match) => {
      count(match.length > 0 ? 1 : 0);
      return "";
    });
  };
  drop(/<!--[\s\S]*?-->/g);
  drop(/<\?xml[\s\S]*?\?>/gi);
  drop(/<(style|script|title)\b[\s\S]*?<\/\1>/gi);
  drop(/<\/?(meta|link|base|col|colgroup)\b[^>]*>/gi);
  // Word's own namespaces: <o:p>, <v:shape>, <w:WordDocument>, <xml>…
  drop(/<\/?(?:o|v|w|m|st1):[a-z0-9-]+\b[^>]*>/gi);
  drop(/<xml\b[\s\S]*?<\/xml>/gi);
  return out;
}

/**
 * Google Docs wraps the whole selection in a bold tag that isn't bold
 * (`<b style="font-weight:normal" id="docs-internal-guid-…">`). Left in, the
 * entire paste arrives bold. It wraps everything, so the last `</b>` is its own.
 */
function unwrapDocsWrapper(html: string, count: (n: number) => void): string {
  return html.replace(/<b\b[^>]*docs-internal-guid-[^>]*>([\s\S]*)<\/b>/i, (_match, inner: string) => {
    count(1);
    return inner;
  });
}

/**
 * Google Docs says bold and italic with inline styles on spans, and the spans
 * themselves are thrown away further down. Turned into real tags first, so the
 * formatting a writer applied survives the trip.
 */
function semanticSpans(html: string, count: (n: number) => void): string {
  // Innermost spans first (the body can hold no span tag of its own), run
  // until nothing is left to unwrap.
  const innermost = /<span\b([^>]*)>((?:(?!<\/?span\b)[\s\S])*)<\/span>/i;
  let out = html;
  // A long document holds thousands of spans; the cap only stops a pathological loop.
  for (let pass = 0; pass < 20_000; pass++) {
    const found = innermost.exec(out);
    if (!found) break;
    const [match, attrs = "", inner = ""] = found;
    const style = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const css = (style?.[2] ?? style?.[3] ?? "").toLowerCase();
    let wrapped = inner;
    if (/(^|[;\s])font-weight\s*:\s*(bold|[6-9]00)/.test(css)) wrapped = `<strong>${wrapped}</strong>`;
    if (/(^|[;\s])font-style\s*:\s*italic/.test(css)) wrapped = `<em>${wrapped}</em>`;
    if (/text-decoration[a-z-]*\s*:[^;]*line-through/.test(css)) wrapped = `<s>${wrapped}</s>`;
    count(1);
    out = out.slice(0, found.index) + wrapped + out.slice(found.index + match.length);
  }
  return out;
}

/** Headings written as real tags, moved into the H2–H4 range. */
function remapRealHeadings(html: string, count: () => void): string {
  // A document that starts at H1 is using H1 as "section"; everything shifts
  // down one so its structure survives. One that already starts at H2 keeps
  // its levels and only has its too-deep ones pulled up.
  const shift = /<h1\b/i.test(html) ? 1 : 0;
  return html.replace(/<(\/?)h([1-6])\b([^>]*)>/gi, (_match, slash: string, level: string, attrs: string) => {
    const next = clamp(Number(level) + shift);
    if (next !== Number(level) && !slash) count();
    return `<${slash}h${next}${slash ? "" : attrs}>`;
  });
}

/** Word writes headings as styled paragraphs: class="MsoHeading2", style="mso-outline-level:2". */
function remapWordHeadings(html: string, count: () => void): string {
  return html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs: string, inner: string) => {
    const title = /\bMso(Title|Subtitle)\b/i.exec(attrs);
    const heading = /\bMsoHeading\s?([1-9])\b/i.exec(attrs) ?? /mso-outline-level\s*:\s*([1-9])/i.exec(attrs);
    if (!title && !heading) return match;
    const level = title ? MIN_LEVEL : clamp(Number(heading![1]) + 1);
    count();
    return `<h${level}>${inner}</h${level}>`;
  });
}

/**
 * Images can't travel: the media library owns every image on the site, and a
 * remote URL in the clipboard is not a file we hold. They come out here and
 * the writer is told which ones went missing.
 */
function takeImages(html: string, images: string[]): string {
  return html.replace(/<img\b([^>]*)>/gi, (_match, attrs: string) => {
    const src = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const url = (src?.[2] ?? src?.[3] ?? src?.[4] ?? "").trim();
    if (url && !url.startsWith("data:")) images.push(url);
    else if (url) images.push("");
    return "";
  });
}

/** What each element is allowed to keep. Everything else is presentation. */
const KEEP: Record<string, string[]> = {
  a: ["href"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  ol: ["start"],
};

function stripAttributes(html: string, count: (n: number) => void): string {
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag: string, attrs: string) => {
    if (!attrs.trim() || attrs.trim() === "/") return match;
    const allowed = KEEP[tag.toLowerCase()] ?? [];
    const kept: string[] = [];
    let dropped = 0;
    const attribute = /([a-z_:][-a-z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi;
    for (let found = attribute.exec(attrs); found; found = attribute.exec(attrs)) {
      const name = found[1]!.toLowerCase();
      if (allowed.includes(name)) kept.push(found[0]!.trim());
      else dropped++;
    }
    count(dropped);
    return `<${tag}${kept.length ? ` ${kept.join(" ")}` : ""}>`;
  });
}

/** Wrappers with nothing to say, and the tags the schema spells differently. */
function normaliseTags(html: string, count: (n: number) => void): string {
  let out = html;
  // Underline isn't in the schema (StarterKit runs with underline: false), so
  // an <u> left standing would take its text down with it.
  out = out.replace(/<\/?(span|font|div|u|section|article|header|footer|center)\b[^>]*>/gi, () => {
    count(1);
    return "";
  });
  out = out.replace(/<(\/?)b\b[^>]*>/gi, "<$1strong>");
  out = out.replace(/<(\/?)i\b[^>]*>/gi, "<$1em>");
  return out;
}

/** Word pads its documents with empty paragraphs; they'd arrive as blank lines. */
function dropEmptyParagraphs(html: string, count: (n: number) => void): string {
  return html.replace(/<p>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, () => {
    count(1);
    return "";
  });
}

/**
 * The clipboard's HTML, cut down to what this site can draw, plus a note of
 * what changed so the writer can be told rather than left guessing.
 */
export function cleanPastedHtml(html: string): { html: string; report: PasteReport } {
  const report: PasteReport = { source: detectSource(html), images: [], headingsRemapped: 0, stripped: 0 };
  if (report.source === "plain") return { html, report };

  const strip = (n: number) => {
    report.stripped += n;
  };
  const remapped = () => {
    report.headingsRemapped += 1;
  };

  const { html: withoutPre, blocks } = protectPre(html);
  let out = removeInvisible(withoutPre, strip);
  out = unwrapDocsWrapper(out, strip);
  out = semanticSpans(out, strip);
  out = remapRealHeadings(out, remapped);
  out = remapWordHeadings(out, remapped);
  out = takeImages(out, report.images);
  out = stripAttributes(out, strip);
  out = normaliseTags(out, strip);
  out = dropEmptyParagraphs(out, strip);

  return { html: restorePre(out, blocks), report };
}
