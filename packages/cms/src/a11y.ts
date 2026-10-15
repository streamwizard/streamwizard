import { inlineText, walk, type Doc, type DocNode } from "./doc";

export type A11yIssueCode =
  | "image_missing_alt"
  | "heading_empty"
  | "heading_skipped_level"
  | "link_text_empty"
  | "link_text_vague"
  | "table_without_header";

export interface A11yIssue {
  code: A11yIssueCode;
  // Errors block publishing; warnings are shown in the editor only.
  severity: "error" | "warning";
  // Child indexes from the root, so the editor can scroll to the node.
  path: number[];
  message: string;
}

// Link text that says nothing about where the link goes, out of context
// (screen readers list links on their own).
const VAGUE_LINK_TEXT = new Set(["click here", "here", "this", "link", "read more", "more", "this link", "click"]);

function linkHref(node: DocNode): string | null {
  const link = node.marks?.find((mark) => mark.type === "link");
  return typeof link?.attrs?.href === "string" ? link.attrs.href : null;
}

// Consecutive text nodes with the same href are one link on the page.
function checkLinks(container: DocNode, path: number[], issues: A11yIssue[]): void {
  const children = container.content ?? [];
  let index = 0;
  while (index < children.length) {
    const child = children[index]!;
    const href = child.type === "text" ? linkHref(child) : null;
    if (!href) {
      index++;
      continue;
    }
    const start = index;
    let text = "";
    while (index < children.length && children[index]!.type === "text" && linkHref(children[index]!) === href) {
      text += children[index]!.text ?? "";
      index++;
    }
    const label = text
      .trim()
      .toLowerCase()
      .replace(/[.!?:]+$/, "");
    const at = [...path, start];
    if (!label) {
      issues.push({
        code: "link_text_empty",
        severity: "error",
        path: at,
        message: "This link has no text. Add words that say where it goes.",
      });
    } else if (VAGUE_LINK_TEXT.has(label)) {
      issues.push({
        code: "link_text_vague",
        severity: "warning",
        path: at,
        message: `"${text.trim()}" doesn't say where the link goes. Try something like "OBS setup guide".`,
      });
    }
  }
}

export interface A11yIssueLocation {
  // null for the body, otherwise the guide section's index.
  section: number | null;
}

// The checks the editor shows live and the publish button enforces. The page
// title is the H1, so the first heading in the body must be an H2. A guide
// section's title renders as an H2, so its own headings continue from there.
// No heading may skip a level on the way down.
export function checkAccessibility(body: Doc, sections: readonly Doc[] = []): (A11yIssue & A11yIssueLocation)[] {
  const issues: (A11yIssue & A11yIssueLocation)[] = [];
  checkDoc(body, 1, issues, null);
  sections.forEach((section, index) => checkDoc(section, 2, issues, index));
  return issues;
}

function checkDoc(doc: Doc, startLevel: number, out: (A11yIssue & A11yIssueLocation)[], section: number | null): void {
  const issues: A11yIssue[] = [];
  let previousLevel = startLevel;
  walk(doc, (node, path) => {
    switch (node.type) {
      case "image":
        if (node.attrs?.decorative !== true && !String(node.attrs?.alt ?? "").trim()) {
          issues.push({
            code: "image_missing_alt",
            severity: "error",
            path,
            message: "This image needs alt text. Describe what it shows, or mark it as decorative.",
          });
        }
        break;
      case "heading": {
        const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
        if (!inlineText(node).trim()) {
          issues.push({
            code: "heading_empty",
            severity: "error",
            path,
            message: "This heading is empty. Add text or remove it.",
          });
        }
        if (level > previousLevel + 1) {
          issues.push({
            code: "heading_skipped_level",
            severity: "error",
            path,
            message: `This heading jumps from H${previousLevel} to H${level}. Use H${previousLevel + 1} here.`,
          });
        }
        previousLevel = level;
        checkLinks(node, path, issues);
        break;
      }
      case "paragraph":
        checkLinks(node, path, issues);
        break;
      case "table": {
        const firstRow = node.content?.[0];
        if (!firstRow?.content?.some((cell) => cell.type === "tableHeader")) {
          issues.push({
            code: "table_without_header",
            severity: "warning",
            path,
            message:
              "This table has no header row. Turn the first row into headers so screen readers can label each column.",
          });
        }
        break;
      }
    }
  });
  for (const issue of issues) out.push({ ...issue, section });
}

export function hasBlockingIssues(issues: A11yIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
