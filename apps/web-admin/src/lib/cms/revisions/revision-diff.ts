import { inlineText, type Doc, type DocNode } from "@repo/cms";

// What changed between a revision and the draft, as a writer reads it: each
// field as lines of text with the structure spelled out ("## " for an H2, so
// an H3 turned into an H2 shows up), then a line diff, then a word diff
// inside lines that changed. Pure, so the compare page and its tests share it.

/** The parts of a post a writer compares. */
export interface ComparableFields {
  title: string;
  slug: string;
  summary: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  body: Doc;
  sections: { title: string; body: Doc }[];
}

function blockLines(node: DocNode, prefix = ""): string[] {
  const text = () => inlineText(node).trim();
  switch (node.type) {
    case "heading":
      return [`${"#".repeat(Number(node.attrs?.level ?? 2))} ${text()}`];
    case "paragraph":
      return text() ? [`${prefix}${text()}`] : [];
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).flatMap((item, index) =>
        (item.content ?? []).flatMap((child, childIndex) =>
          blockLines(child, childIndex === 0 ? (node.type === "bulletList" ? "• " : `${index + 1}. `) : "  "),
        ),
      );
    case "blockquote":
      return (node.content ?? []).flatMap((child) => blockLines(child, "> "));
    case "callout":
      return (node.content ?? []).flatMap((child) => blockLines(child, `[${String(node.attrs?.variant ?? "note")}] `));
    case "codeBlock":
      return text()
        .split("\n")
        .map((line) => `    ${line}`);
    case "image":
      return [`[image: ${String(node.attrs?.alt ?? "") || "no alt text"}]`];
    case "embed":
      return [`[video: ${String(node.attrs?.provider ?? "")} ${String(node.attrs?.id ?? "")}]`.trim()];
    case "horizontalRule":
      return ["---"];
    case "table":
      return (node.content ?? []).map((row) => (row.content ?? []).map((cell) => inlineText(cell).trim()).join(" | "));
    default:
      return text() ? [text()] : [];
  }
}

export function docLines(doc: Doc): string[] {
  return (doc.content ?? []).flatMap((node) => blockLines(node));
}

/** Every field as labelled lines, in the order the editor shows them. */
export function comparableText(fields: ComparableFields, guide: boolean): { label: string; lines: string[] }[] {
  const plain = (label: string, value: string) => ({ label, lines: value.trim() ? value.trim().split("\n") : [] });
  return [
    plain("Title", fields.title),
    plain("Slug", fields.slug),
    plain("Summary", fields.summary),
    plain("Excerpt", fields.excerpt),
    plain("SEO title", fields.seoTitle),
    plain("Meta description", fields.seoDescription),
    { label: guide ? "Intro" : "Body", lines: docLines(fields.body) },
    ...(guide
      ? [
          {
            label: "Sections",
            lines: fields.sections.flatMap((section, index) => [
              `## ${section.title.trim() || `Section ${index + 1}`}`,
              ...docLines(section.body),
            ]),
          },
        ]
      : []),
  ];
}

export type DiffLine =
  | { kind: "same"; text: string }
  | { kind: "removed"; text: string }
  | { kind: "added"; text: string }
  /** One line rewritten: the words that went and came. */
  | { kind: "changed"; parts: DiffPart[] };

export interface DiffPart {
  kind: "same" | "removed" | "added";
  text: string;
}

/** Longest-common-subsequence diff of two lists, as same / removed / added steps. */
function diffSequence<T>(before: T[], after: T[]): { kind: "same" | "removed" | "added"; value: T }[] {
  const rows = before.length;
  const cols = after.length;
  const lcs = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i--)
    for (let j = cols - 1; j >= 0; j--)
      lcs[i]![j] = before[i] === after[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);

  const steps: { kind: "same" | "removed" | "added"; value: T }[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      steps.push({ kind: "same", value: before[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      steps.push({ kind: "removed", value: before[i++]! });
    } else {
      steps.push({ kind: "added", value: after[j++]! });
    }
  }
  while (i < rows) steps.push({ kind: "removed", value: before[i++]! });
  while (j < cols) steps.push({ kind: "added", value: after[j++]! });
  return steps;
}

/** Word-level parts of one rewritten line. Whitespace sticks to the word before it. */
export function diffWords(before: string, after: string): DiffPart[] {
  const words = (text: string) => text.match(/\S+\s*/g) ?? [];
  const parts: DiffPart[] = [];
  for (const step of diffSequence(words(before), words(after))) {
    const last = parts[parts.length - 1];
    if (last && last.kind === step.kind) last.text += step.value;
    else parts.push({ kind: step.kind, text: step.value });
  }
  return parts;
}

/**
 * Line diff of one field. A removed line followed by an added one is shown as
 * one changed line with its words marked, which is how an edit reads.
 */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const steps = diffSequence(before, after);
  const lines: DiffLine[] = [];
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]!;
    if (step.kind === "same") {
      lines.push({ kind: "same", text: step.value });
      continue;
    }
    // Pair a run of removals with the run of additions right after it.
    const removed: string[] = [];
    const added: string[] = [];
    while (index < steps.length && steps[index]!.kind === "removed") removed.push(steps[index++]!.value);
    while (index < steps.length && steps[index]!.kind === "added") added.push(steps[index++]!.value);
    index--;
    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k++) lines.push({ kind: "changed", parts: diffWords(removed[k]!, added[k]!) });
    for (const text of removed.slice(pairs)) lines.push({ kind: "removed", text });
    for (const text of added.slice(pairs)) lines.push({ kind: "added", text });
  }
  return lines;
}

/** Fields that differ, each with its line diff. */
export function compareRevision(
  before: ComparableFields,
  after: ComparableFields,
  guide: boolean,
): { label: string; lines: DiffLine[] }[] {
  const old = comparableText(before, guide);
  const now = comparableText(after, guide);
  return old.flatMap((field, index) => {
    const lines = diffLines(field.lines, now[index]!.lines);
    return lines.some((line) => line.kind !== "same") ? [{ label: field.label, lines }] : [];
  });
}
