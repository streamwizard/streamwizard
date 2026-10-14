import { describe, expect, it } from "bun:test";
import { checkAccessibility, hasBlockingIssues } from "./a11y";
import type { Doc, DocNode } from "./doc";

function heading(level: number, text = "Title"): DocNode {
  return { type: "heading", attrs: { level }, content: text ? [{ type: "text", text }] : undefined };
}
function linked(value: string, href = "https://docs.streamwizard.org"): DocNode {
  return { type: "text", text: value, marks: [{ type: "link", attrs: { href } }] };
}
function doc(...content: DocNode[]): Doc {
  return { type: "doc", content };
}

describe("checkAccessibility", () => {
  it("passes a clean document", () => {
    const body = doc(heading(2), heading(3), heading(4), heading(2), {
      type: "paragraph",
      content: [{ type: "text", text: "See the " }, linked("OBS setup guide")],
    });
    expect(checkAccessibility(body)).toEqual([]);
  });

  it("requires alt text unless the image is decorative", () => {
    const issues = checkAccessibility(
      doc(
        { type: "image", attrs: { alt: "  " } },
        { type: "image", attrs: { alt: "", decorative: true } },
        { type: "image", attrs: { alt: "OBS" } },
      ),
    );
    expect(issues.map((issue) => [issue.code, issue.path])).toEqual([["image_missing_alt", [0]]]);
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("flags skipped heading levels, starting below the page title", () => {
    const issues = checkAccessibility(doc(heading(3), heading(2), heading(4), heading(3)));
    expect(issues.map((issue) => [issue.code, issue.path])).toEqual([
      ["heading_skipped_level", [0]],
      ["heading_skipped_level", [2]],
    ]);
    expect(issues[0]?.message).toBe("This heading jumps from H1 to H3. Use H2 here.");
  });

  it("starts each guide section below its H2 title", () => {
    const issues = checkAccessibility(doc(heading(2)), [doc(heading(3)), doc(heading(4))]);
    expect(issues.map((issue) => [issue.code, issue.section])).toEqual([["heading_skipped_level", 1]]);
  });

  it("flags empty headings", () => {
    expect(checkAccessibility(doc(heading(2, ""))).map((issue) => issue.code)).toEqual(["heading_empty"]);
  });

  it("reads split text nodes as one link", () => {
    const issues = checkAccessibility(
      doc({
        type: "paragraph",
        content: [
          linked("click "),
          {
            type: "text",
            text: "here",
            marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://docs.streamwizard.org" } }],
          },
        ],
      }),
    );
    expect(issues.map((issue) => [issue.code, issue.severity, issue.path])).toEqual([
      ["link_text_vague", "warning", [0, 0]],
    ]);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("flags links with only whitespace", () => {
    expect(checkAccessibility(doc({ type: "paragraph", content: [linked("  ")] })).map((issue) => issue.code)).toEqual([
      "link_text_empty",
    ]);
  });

  it("warns about tables without a header row", () => {
    const cell = (type: string): DocNode => ({
      type,
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    });
    const issues = checkAccessibility(
      doc({ type: "table", content: [{ type: "tableRow", content: [cell("tableCell")] }] }),
    );
    expect(issues.map((issue) => [issue.code, issue.severity])).toEqual([["table_without_header", "warning"]]);
    expect(
      checkAccessibility(doc({ type: "table", content: [{ type: "tableRow", content: [cell("tableHeader")] }] })),
    ).toEqual([]);
  });
});
