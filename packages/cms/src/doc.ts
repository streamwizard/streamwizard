// The stored shape of a blog or guide body: Tiptap's JSON document. We never
// store or render HTML. Everything that reaches the database goes through
// sanitizeDoc, which keeps only the nodes, marks and attributes the public
// renderer knows how to draw, so the renderer can trust what it reads.

import { isEmbedProvider, isValidEmbedId } from "./embed";

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

export interface Doc {
  type: "doc";
  content: DocNode[];
}

export const EMPTY_DOC: Doc = { type: "doc", content: [] };

export type SanitizeIssueCode =
  | "invalid_doc"
  | "unknown_node"
  | "misplaced_node"
  | "invalid_node"
  | "unknown_mark"
  | "invalid_link"
  | "too_deep"
  | "too_large";

export interface SanitizeIssue {
  code: SanitizeIssueCode;
  // Where in the tree, as child indexes from the root ("0.2.1").
  path: string;
  detail: string;
}

export interface SanitizeResult {
  doc: Doc;
  issues: SanitizeIssue[];
}

// The editor allows H2 to H4. The page title is the only H1.
export const MIN_HEADING_LEVEL = 2;
export const MAX_HEADING_LEVEL = 4;

export const CALLOUT_VARIANTS = ["info", "tip", "warning"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

const MAX_DEPTH = 20;
const MAX_NODES = 20_000;
const MAX_ALT_LENGTH = 300;
const MAX_CAPTION_LENGTH = 300;
const MAX_HREF_LENGTH = 2048;
const MAX_TABLE_SPAN = 20;

type Category = "block" | "inline" | "listItem" | "tableRow" | "tableCell";

interface NodeSpec {
  category: Category;
  // What its children may be. Omitted: a leaf (atom) node.
  children?: Category;
  // Children must be plain text without marks (code blocks).
  plainText?: boolean;
  // Cleans the attributes. Returns null when the node is unusable.
  attrs?: (attrs: Record<string, unknown>) => Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function intInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_LANGUAGE = /^[a-z0-9+#-]{1,20}$/;

const NODE_SPECS: Record<string, NodeSpec> = {
  paragraph: { category: "block", children: "inline" },
  heading: {
    category: "block",
    children: "inline",
    attrs: (attrs) => {
      const level = typeof attrs.level === "number" ? Math.round(attrs.level) : MIN_HEADING_LEVEL;
      return { level: Math.min(MAX_HEADING_LEVEL, Math.max(MIN_HEADING_LEVEL, level)) };
    },
  },
  bulletList: { category: "block", children: "listItem" },
  orderedList: {
    category: "block",
    children: "listItem",
    attrs: (attrs) => ({ start: intInRange(attrs.start, 1, 10_000) ?? 1 }),
  },
  listItem: { category: "listItem", children: "block" },
  blockquote: { category: "block", children: "block" },
  codeBlock: {
    category: "block",
    children: "inline",
    plainText: true,
    attrs: (attrs) => ({
      language: typeof attrs.language === "string" && CODE_LANGUAGE.test(attrs.language) ? attrs.language : null,
    }),
  },
  horizontalRule: { category: "block" },
  image: {
    category: "block",
    attrs: (attrs) => {
      if (typeof attrs.assetId !== "string" || !UUID.test(attrs.assetId)) return null;
      const cleaned: Record<string, unknown> = {
        assetId: attrs.assetId.toLowerCase(),
        alt: cleanString(attrs.alt, MAX_ALT_LENGTH),
        decorative: attrs.decorative === true,
        caption: cleanString(attrs.caption, MAX_CAPTION_LENGTH) || null,
      };
      // Filled in from cms_assets when a post is published, so the renderer
      // never needs a second lookup. Kept only when well-formed.
      if (typeof attrs.src === "string" && /^https:\/\//.test(attrs.src)) cleaned.src = attrs.src;
      const width = intInRange(attrs.width, 1, 20_000);
      const height = intInRange(attrs.height, 1, 20_000);
      if (width && height) {
        cleaned.width = width;
        cleaned.height = height;
      }
      return cleaned;
    },
  },
  callout: {
    category: "block",
    children: "block",
    attrs: (attrs) => ({
      variant: (CALLOUT_VARIANTS as readonly string[]).includes(attrs.variant as string) ? attrs.variant : "info",
    }),
  },
  // A provider and an id, never a URL or iframe markup: the renderer builds
  // the iframe src itself.
  embed: {
    category: "block",
    attrs: (attrs) => {
      const { provider, id } = attrs;
      if (!isEmbedProvider(provider) || typeof id !== "string" || !isValidEmbedId(provider, id)) return null;
      return { provider, id };
    },
  },
  table: { category: "block", children: "tableRow" },
  tableRow: { category: "tableRow", children: "tableCell" },
  tableHeader: { category: "tableCell", children: "block", attrs: cellAttrs },
  tableCell: { category: "tableCell", children: "block", attrs: cellAttrs },
  text: { category: "inline" },
  hardBreak: { category: "inline" },
};

function cellAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return {
    colspan: intInRange(attrs.colspan, 1, MAX_TABLE_SPAN) ?? 1,
    rowspan: intInRange(attrs.rowspan, 1, MAX_TABLE_SPAN) ?? 1,
  };
}

const SIMPLE_MARKS = new Set(["bold", "italic", "strike", "code"]);

// Absolute http(s), mailto, site-relative ("/pricing") and in-page ("#setup")
// links. Anything else (javascript:, data:, protocol-relative "//host") is
// refused.
export function sanitizeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (!href || href.length > MAX_HREF_LENGTH) return null;
  if (href.startsWith("#")) return /^#[A-Za-z0-9_-]+$/.test(href) ? href : null;
  if (href.startsWith("/")) return href.startsWith("//") || /[\s\\]/.test(href) ? null : href;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol === "https:" || url.protocol === "http:") return url.hostname ? url.toString() : null;
  if (url.protocol === "mailto:") return url.pathname.includes("@") ? href : null;
  return null;
}

function sanitizeMarks(raw: unknown, path: string, issues: SanitizeIssue[]): DocMark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const marks: DocMark[] = [];
  const seen = new Set<string>();
  for (const mark of raw) {
    if (!isRecord(mark) || typeof mark.type !== "string") continue;
    if (seen.has(mark.type)) continue;
    if (SIMPLE_MARKS.has(mark.type)) {
      marks.push({ type: mark.type });
      seen.add(mark.type);
    } else if (mark.type === "link") {
      const href = sanitizeHref(isRecord(mark.attrs) ? mark.attrs.href : undefined);
      if (href) {
        marks.push({ type: "link", attrs: { href } });
        seen.add("link");
      } else {
        issues.push({
          code: "invalid_link",
          path,
          detail: "Link removed: only http(s), mailto and site links are allowed.",
        });
      }
    } else {
      issues.push({ code: "unknown_mark", path, detail: `Unknown mark "${mark.type}" removed.` });
    }
  }
  return marks.length > 0 ? marks : undefined;
}

interface WalkState {
  issues: SanitizeIssue[];
  nodes: number;
}

function sanitizeChildren(raw: unknown, parent: NodeSpec, path: string, depth: number, state: WalkState): DocNode[] {
  if (!Array.isArray(raw)) return [];
  const out: DocNode[] = [];
  raw.forEach((child, index) => {
    const node = sanitizeNode(child, parent, path ? `${path}.${index}` : String(index), depth, state);
    if (node) out.push(node);
  });
  return out;
}

function sanitizeNode(raw: unknown, parent: NodeSpec, path: string, depth: number, state: WalkState): DocNode | null {
  if (state.nodes >= MAX_NODES) {
    if (state.nodes === MAX_NODES) {
      state.issues.push({ code: "too_large", path, detail: "Document is too large, the rest was cut off." });
      state.nodes++;
    }
    return null;
  }
  if (depth > MAX_DEPTH) {
    state.issues.push({ code: "too_deep", path, detail: "Content nested too deep was removed." });
    return null;
  }
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  const spec = NODE_SPECS[raw.type];
  if (!spec) {
    state.issues.push({ code: "unknown_node", path, detail: `Unknown block "${raw.type}" removed.` });
    return null;
  }
  if (spec.category !== parent.children) {
    state.issues.push({ code: "misplaced_node", path, detail: `"${raw.type}" can't go inside this block, removed.` });
    return null;
  }
  state.nodes++;

  if (raw.type === "text") {
    if (typeof raw.text !== "string" || raw.text.length === 0) return null;
    const marks = parent.plainText ? undefined : sanitizeMarks(raw.marks, path, state.issues);
    return marks ? { type: "text", text: raw.text, marks } : { type: "text", text: raw.text };
  }
  if (parent.plainText) {
    // Only text inside code blocks; a hard break becomes a newline.
    return raw.type === "hardBreak" ? { type: "text", text: "\n" } : null;
  }

  const node: DocNode = { type: raw.type };
  if (spec.attrs) {
    const attrs = spec.attrs(isRecord(raw.attrs) ? raw.attrs : {});
    if (!attrs) {
      state.issues.push({ code: "invalid_node", path, detail: `"${raw.type}" is missing required details, removed.` });
      return null;
    }
    node.attrs = attrs;
  }
  if (spec.children) {
    const content = sanitizeChildren(raw.content, spec, path, depth + 1, state);
    // Containers that lost every child would render as empty boxes.
    if (content.length === 0 && spec.children !== "inline") return null;
    if (content.length > 0) node.content = content;
  }
  return node;
}

const ROOT: NodeSpec = { category: "block", children: "block" };

export function sanitizeDoc(input: unknown): SanitizeResult {
  const state: WalkState = { issues: [], nodes: 0 };
  if (!isRecord(input) || input.type !== "doc") {
    return {
      doc: { ...EMPTY_DOC, content: [] },
      issues: [{ code: "invalid_doc", path: "", detail: "Not a document." }],
    };
  }
  return { doc: { type: "doc", content: sanitizeChildren(input.content, ROOT, "", 1, state) }, issues: state.issues };
}

// Depth-first walk in document order. Used by every extractor below, so they
// all agree on what "the order of things" is.
export function walk(node: DocNode | Doc, visit: (node: DocNode, path: number[]) => void, path: number[] = []): void {
  node.content?.forEach((child, index) => {
    const childPath = [...path, index];
    visit(child, childPath);
    walk(child, visit, childPath);
  });
}

// The plain text of an inline container (heading, paragraph). Hard breaks
// count as a space.
export function inlineText(node: DocNode): string {
  let text = "";
  for (const child of node.content ?? []) {
    if (child.type === "text") text += child.text ?? "";
    else if (child.type === "hardBreak") text += " ";
  }
  return text;
}
