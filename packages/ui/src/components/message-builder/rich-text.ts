import { tokenize } from "@repo/discord-message";

// The slice of Discord markdown the preview understands: bold, italic,
// underline, strikethrough, inline code, masked links, bare links and
// placeholders. Pure, so it is tested without a DOM.

export type RichNode =
  | { type: "text"; value: string }
  | { type: "variable"; key: string; raw: string }
  | { type: "link"; href: string; children: RichNode[]; /** [text](address), not a bare address. */ masked?: true }
  | { type: "code"; value: string }
  | { type: "bold" | "italic" | "underline" | "strike"; children: RichNode[] };

// Order matters: code first so nothing inside it is styled, ** before *, __ before _.
const RULES: { pattern: RegExp; build: (match: RegExpExecArray) => RichNode }[] = [
  { pattern: /`([^`\n]+)`/, build: (m) => ({ type: "code", value: m[1] ?? "" }) },
  {
    pattern: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/,
    build: (m) => ({ type: "link", href: m[2] ?? "", children: parseInline(m[1] ?? ""), masked: true }),
  },
  { pattern: /https?:\/\/[^\s<>)]+/, build: (m) => ({ type: "link", href: m[0], children: [{ type: "text", value: m[0] }] }) },
  { pattern: /\*\*([^\n]+?)\*\*/, build: (m) => ({ type: "bold", children: parseInline(m[1] ?? "") }) },
  { pattern: /__([^\n]+?)__/, build: (m) => ({ type: "underline", children: parseInline(m[1] ?? "") }) },
  { pattern: /~~([^\n]+?)~~/, build: (m) => ({ type: "strike", children: parseInline(m[1] ?? "") }) },
  { pattern: /\*([^*\n]+?)\*/, build: (m) => ({ type: "italic", children: parseInline(m[1] ?? "") }) },
  { pattern: /(?<![\w])_([^_\n]+?)_(?![\w])/, build: (m) => ({ type: "italic", children: parseInline(m[1] ?? "") }) },
];

function parseInline(text: string): RichNode[] {
  if (!text) return [];
  let first: { index: number; match: RegExpExecArray; build: (m: RegExpExecArray) => RichNode } | null = null;
  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (match && (first === null || match.index < first.index)) first = { index: match.index, match, build: rule.build };
  }
  if (!first) return tokenize(text);
  const before = text.slice(0, first.index);
  const after = text.slice(first.index + first.match[0].length);
  return [...tokenize(before), first.build(first.match), ...parseInline(after)];
}

/** Markdown first, placeholders inside what is left, so **Welcome to [server.name]** is bold with a chip in it. */
export function parseRichText(text: string): RichNode[] {
  return parseInline(text);
}
