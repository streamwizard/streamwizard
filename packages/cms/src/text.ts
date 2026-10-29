import { walk, type Doc, type DocNode } from "./doc";

// The blocks whose text is read as one run. Lists, quotes, callouts and
// tables are containers: their text lives in the paragraphs inside them.
const TEXT_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

function blockText(node: DocNode): string {
  let text = "";
  for (const child of node.content ?? []) {
    if (child.type === "text") text += child.text ?? "";
    else if (child.type === "hardBreak") text += "\n";
  }
  return text;
}

// Plain text of a document, one block per line. Stored next to the body for
// search, and the input for word counts.
export function extractText(doc: Doc): string {
  const blocks: string[] = [];
  walk(doc, (node) => {
    if (!TEXT_BLOCKS.has(node.type)) return;
    const text = blockText(node).trim();
    if (text) blocks.push(text);
  });
  return blocks.join("\n");
}

const WORD = /[\p{L}\p{N}]/u;

export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) if (WORD.test(token)) count++;
  return count;
}

export const WORDS_PER_MINUTE = 225;
// Code is skimmed, not read word by word.
const CODE_WORD_WEIGHT = 0.5;
// Looking at a screenshot takes a moment too.
const SECONDS_PER_IMAGE = 12;

export interface ReadingStats {
  words: number;
  minutes: number;
}

// Reading time over the body and, for guides, every section. Never below one
// minute: "0 min read" reads like an empty page.
export function readingStats(docs: Doc[]): ReadingStats {
  let words = 0;
  let weighted = 0;
  let images = 0;
  for (const doc of docs) {
    walk(doc, (node) => {
      if (node.type === "image") images++;
      if (!TEXT_BLOCKS.has(node.type)) return;
      const count = countWords(blockText(node));
      words += count;
      weighted += node.type === "codeBlock" ? count * CODE_WORD_WEIGHT : count;
    });
  }
  const seconds = (weighted / WORDS_PER_MINUTE) * 60 + images * SECONDS_PER_IMAGE;
  return { words, minutes: Math.max(1, Math.round(seconds / 60)) };
}
