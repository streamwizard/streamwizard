// Masked links, [label](https://…), without anyone typing the syntax: the
// link menu and paste-over-selection both go through here. Pure, so it is
// tested without a DOM.

export interface TextRange {
  start: number;
  end: number;
}

export interface LinkAt extends TextRange {
  label: string;
  url: string;
}

// Same shape the preview renders as a link (rich-text.ts).
const MASKED_LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Every masked link in the text, in order. */
export function findLinks(text: string): LinkAt[] {
  return [...text.matchAll(MASKED_LINK)].map((match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length, label: match[1] ?? "", url: match[2] ?? "" };
  });
}

export type LinkSegment = { type: "text"; value: string } | ({ type: "link" } & LinkAt);

/** The text cut into plain runs and links, for an editor that shows links as one piece. */
export function splitLinks(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let cursor = 0;
  for (const link of findLinks(text)) {
    if (link.start > cursor) segments.push({ type: "text", value: text.slice(cursor, link.start) });
    segments.push({ type: "link", ...link });
    cursor = link.end;
  }
  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}

/** The masked link the range sits in or touches, so the menu edits it instead of nesting a new one. */
export function findLinkAt(text: string, range: TextRange): LinkAt | null {
  return findLinks(text).find((link) => range.start >= link.start && range.end <= link.end) ?? null;
}

/** What someone types or pastes as an address, made into one Discord accepts. Null when it can't be. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  // A ")" would end the link early.
  return withScheme.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/** Square brackets can't sit inside a label; the link would stop rendering. */
const cleanLabel = (label: string) => label.replace(/[[\]\n]/g, " ").replace(/ {2,}/g, " ").trim();

export function formatLink(label: string, url: string): string {
  return `[${cleanLabel(label) || url}](${url})`;
}

/** Puts a link over `range`. Returns the new text and where the caret belongs after it. */
export function applyLink(text: string, range: TextRange, label: string, url: string): { text: string; caret: number } {
  const link = formatLink(label, url);
  const start = Math.min(Math.max(range.start, 0), text.length);
  const end = Math.min(Math.max(range.end, start), text.length);
  return { text: text.slice(0, start) + link + text.slice(end), caret: start + link.length };
}

/** Takes the link away and leaves its label. */
export function removeLink(text: string, link: LinkAt): { text: string; caret: number } {
  return { text: text.slice(0, link.start) + link.label + text.slice(link.end), caret: link.start + link.label.length };
}

/**
 * Pasting an address over selected words links them, as in Discord, Slack and
 * Notion. Null when the paste should go through untouched.
 */
export function pasteAsLink(text: string, range: TextRange, pasted: string): { text: string; caret: number } | null {
  if (range.start === range.end) return null;
  if (!/^https?:\/\/\S+$/i.test(pasted.trim())) return null;
  const url = normalizeUrl(pasted);
  if (!url) return null;
  const selected = text.slice(range.start, range.end);
  if (selected.includes("\n") || /^https?:\/\//i.test(selected.trim())) return null;
  if (findLinkAt(text, range)) return null;
  return applyLink(text, range, selected, url);
}
