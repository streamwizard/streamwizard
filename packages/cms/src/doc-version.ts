// The stored body's format version, kept inside the document itself
// (doc.attrs.v) rather than in a column: the same JSON lives in
// cms_content.body, cms_guide_sections.body, the published copy, every
// revision snapshot and the browser's recovery copy, and an attribute travels
// with all of them for free.
//
// Writes stamp the current version (sanitizeDoc does it, so every write
// path does). Reads run migrateDoc, which upgrades in memory only: the new
// shape is persisted the next time the post is saved or published.

import type { Doc, DocNode } from "./doc";

/** Bumped whenever a stored document's shape changes. 1 is everything written before versions existed. */
export const DOC_VERSION = 2;

const FIRST_VERSION = 1;

/**
 * One step up. Each entry takes a document at version N and returns it at
 * N + 1. Empty today: version 2 only marks that headings may carry an
 * `anchor`, which older documents are simply missing.
 */
const UPGRADES: Record<number, (doc: Doc) => Doc> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The version a stored document claims. Anything unmarked or unreadable is version 1. */
export function docVersion(input: unknown): number {
  if (!isRecord(input)) return FIRST_VERSION;
  const attrs = input.attrs;
  if (!isRecord(attrs)) return FIRST_VERSION;
  const version = attrs.v;
  return typeof version === "number" && Number.isInteger(version) && version >= FIRST_VERSION
    ? version
    : FIRST_VERSION;
}

/** The document as it is stored: content plus the version it was written at. */
export function stampDoc(doc: Doc): Doc {
  return { type: "doc", attrs: { v: DOC_VERSION }, content: doc.content };
}

export interface MigrateResult {
  /** The document at the current version, without the stamp: the editor owns a plain doc. */
  doc: Doc;
  /** The version it was stored at. */
  from: number;
  /** It was written by a newer deploy than this one. Show it, don't save over it. */
  future: boolean;
}

/**
 * A stored body, read at the current version. The result carries no `attrs.v`
 * on purpose: Tiptap's document node declares no attributes, so the editor
 * would drop it on the first keystroke and autosave would see a change that
 * isn't one.
 */
export function migrateDoc(input: unknown): MigrateResult {
  if (!isRecord(input) || input.type !== "doc") {
    return { doc: { type: "doc", content: [] }, from: DOC_VERSION, future: false };
  }
  const from = docVersion(input);
  const content = Array.isArray(input.content) ? (input.content as DocNode[]) : [];
  let doc: Doc = { type: "doc", content };
  if (from > DOC_VERSION) return { doc, from, future: true };
  for (let version = from; version < DOC_VERSION; version++) {
    const upgrade = UPGRADES[version];
    if (upgrade) doc = { type: "doc", content: upgrade(doc).content };
  }
  return { doc, from, future: false };
}
