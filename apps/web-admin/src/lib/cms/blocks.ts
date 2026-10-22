// Everything a writer can add to a page, named the way they'd ask for it.
// One catalog, so the "+" button and (later) a slash menu can never drift
// apart on what exists or what it's called.

export type BlockId =
  | "paragraph"
  | "heading"
  | "subheading"
  | "smallHeading"
  | "bulletList"
  | "orderedList"
  | "quote"
  | "note"
  | "tip"
  | "warning"
  | "codeBlock"
  | "image"
  | "embed"
  | "table"
  | "divider";

export type BlockGroup = "text" | "media" | "structure";

export interface BlockOption {
  id: BlockId;
  label: string;
  /** One line, in the writer's terms, about what it is for. */
  hint: string;
  group: BlockGroup;
  /** Extra words that should find it, beyond the label. */
  keywords: string[];
}

export const BLOCK_GROUP_LABELS: Record<BlockGroup, string> = {
  text: "Text",
  media: "Media",
  structure: "Structure",
};

export const BLOCKS: readonly BlockOption[] = [
  { id: "paragraph", label: "Normal text", hint: "Plain paragraph", group: "text", keywords: ["paragraph", "body"] },
  { id: "heading", label: "Heading", hint: "Starts a section", group: "text", keywords: ["h2", "title", "section"] },
  { id: "subheading", label: "Subheading", hint: "Inside a section", group: "text", keywords: ["h3"] },
  { id: "smallHeading", label: "Small heading", hint: "The level below that", group: "text", keywords: ["h4"] },
  { id: "bulletList", label: "Bulleted list", hint: "Points in no order", group: "text", keywords: ["ul", "bullets"] },
  { id: "orderedList", label: "Numbered list", hint: "Steps in order", group: "text", keywords: ["ol", "steps"] },
  { id: "quote", label: "Quote", hint: "Someone else's words", group: "text", keywords: ["blockquote", "citation"] },
  { id: "note", label: "Note", hint: "Something worth knowing", group: "structure", keywords: ["callout", "info"] },
  { id: "tip", label: "Tip", hint: "A shortcut or a better way", group: "structure", keywords: ["callout", "hint"] },
  {
    id: "warning",
    label: "Warning",
    hint: "Something that can go wrong",
    group: "structure",
    keywords: ["callout", "caution", "danger"],
  },
  { id: "codeBlock", label: "Code", hint: "A command or a snippet", group: "structure", keywords: ["pre", "snippet"] },
  { id: "image", label: "Image", hint: "From the media library", group: "media", keywords: ["picture", "photo"] },
  { id: "embed", label: "Video", hint: "YouTube, Twitch clip or VOD", group: "media", keywords: ["youtube", "clip"] },
  { id: "table", label: "Table", hint: "Rows and columns", group: "structure", keywords: ["grid", "rows"] },
  { id: "divider", label: "Divider", hint: "A line between parts", group: "structure", keywords: ["hr", "rule"] },
];

/**
 * The blocks worth showing for what has been typed so far. An empty query
 * shows everything, in catalog order; otherwise label matches come before
 * keyword matches, so typing "note" doesn't bury the Note block under every
 * callout.
 */
export function matchBlocks(query: string, blocks: readonly BlockOption[] = BLOCKS): BlockOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...blocks];

  const byLabel: BlockOption[] = [];
  const byKeyword: BlockOption[] = [];
  for (const block of blocks) {
    if (block.label.toLowerCase().includes(needle)) byLabel.push(block);
    else if (block.keywords.some((word) => word.includes(needle)) || block.hint.toLowerCase().includes(needle)) {
      byKeyword.push(block);
    }
  }
  return [...byLabel, ...byKeyword];
}
