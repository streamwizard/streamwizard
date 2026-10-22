import { describe, expect, it } from "bun:test";
import { sanitizeDoc, sanitizeHref, type DocNode } from "./doc";

const ASSET = "0b9f7c1e-6a3d-4c55-9b0e-2f1a8d7e6c4b";

function doc(...content: unknown[]) {
  return { type: "doc", content };
}
function p(...content: unknown[]) {
  return { type: "paragraph", content };
}
function text(value: string, marks?: unknown[]) {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

describe("sanitizeHref", () => {
  it("keeps http(s), mailto, site and in-page links", () => {
    expect(sanitizeHref("https://streamwizard.org/pricing")).toBe("https://streamwizard.org/pricing");
    expect(sanitizeHref("http://example.com")).toBe("http://example.com/");
    expect(sanitizeHref("mailto:hi@streamwizard.org")).toBe("mailto:hi@streamwizard.org");
    expect(sanitizeHref(" /guides/obs-setup ")).toBe("/guides/obs-setup");
    expect(sanitizeHref("#step-2")).toBe("#step-2");
  });

  it("refuses script, data and protocol-relative links", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(sanitizeHref("data:text/html,<script>")).toBeNull();
    expect(sanitizeHref("//evil.example")).toBeNull();
    expect(sanitizeHref("/\\evil.example")).toBeNull();
    expect(sanitizeHref("#a b")).toBeNull();
    expect(sanitizeHref(42)).toBeNull();
  });
});

describe("sanitizeDoc", () => {
  it("passes a clean document through unchanged", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Set up OBS")] },
      p(text("Open "), text("Settings", [{ type: "bold" }]), { type: "hardBreak" }, text("then Output.")),
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("One"))] }] },
    );
    const { doc: out, issues } = sanitizeDoc(input);
    expect(issues).toEqual([]);
    expect(out).toEqual(input as never);
  });

  it("rejects anything that isn't a document", () => {
    expect(sanitizeDoc(null).issues[0]?.code).toBe("invalid_doc");
    expect(sanitizeDoc({ type: "paragraph" }).doc).toEqual({ type: "doc", content: [] });
  });

  it("drops unknown nodes and marks, and reports them", () => {
    const { doc: out, issues } = sanitizeDoc(
      doc(p(text("hi", [{ type: "bold" }, { type: "fontColor", attrs: { color: "red" } }])), {
        type: "iframe",
        attrs: { src: "x" },
      }),
    );
    expect(out.content).toEqual([p(text("hi", [{ type: "bold" }])) as DocNode]);
    expect(issues.map((issue) => issue.code)).toEqual(["unknown_mark", "unknown_node"]);
  });

  it("strips bad links but keeps their text", () => {
    const { doc: out, issues } = sanitizeDoc(
      doc(p(text("click", [{ type: "link", attrs: { href: "javascript:alert(1)", target: "_blank" } }]))),
    );
    expect(out.content[0]?.content?.[0]).toEqual({ type: "text", text: "click" });
    expect(issues[0]?.code).toBe("invalid_link");
  });

  it("keeps only the href on links", () => {
    const { doc: out } = sanitizeDoc(
      doc(p(text("docs", [{ type: "link", attrs: { href: "https://docs.streamwizard.org", onclick: "x" } }]))),
    );
    expect(out.content[0]?.content?.[0]?.marks).toEqual([
      { type: "link", attrs: { href: "https://docs.streamwizard.org/" } },
    ]);
  });

  it("drops blocks in the wrong place", () => {
    const { doc: out, issues } = sanitizeDoc(
      doc(p({ type: "heading", attrs: { level: 2 }, content: [text("x")] }), text("loose text")),
    );
    expect(out.content).toEqual([{ type: "paragraph" }]);
    expect(issues.map((issue) => issue.code)).toEqual(["misplaced_node", "misplaced_node"]);
  });

  it("clamps heading levels to H2-H4", () => {
    const { doc: out } = sanitizeDoc(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("a")] },
        { type: "heading", attrs: { level: 6 }, content: [text("b")] },
      ),
    );
    expect(out.content.map((node) => node.attrs?.level)).toEqual([2, 4]);
  });

  it("keeps only plain text inside code blocks", () => {
    const { doc: out } = sanitizeDoc(
      doc({
        type: "codeBlock",
        attrs: { language: "ts<script>" },
        content: [text("const a = 1", [{ type: "bold" }]), { type: "hardBreak" }, text("a++")],
      }),
    );
    expect(out.content[0]).toEqual({
      type: "codeBlock",
      attrs: { language: null },
      content: [text("const a = 1"), text("\n"), text("a++")] as DocNode[],
    });
  });

  it("cleans image attributes and drops images without an asset", () => {
    const { doc: out, issues } = sanitizeDoc(
      doc(
        {
          type: "image",
          attrs: {
            assetId: ASSET.toUpperCase(),
            alt: "  OBS output tab  ",
            decorative: "yes",
            src: "javascript:x",
            width: 800,
            height: 450,
            onerror: "x",
          },
        },
        { type: "image", attrs: { src: "https://cdn.streamwizard.org/a.png", alt: "no asset" } },
      ),
    );
    expect(out.content).toEqual([
      {
        type: "image",
        attrs: { assetId: ASSET, alt: "OBS output tab", decorative: false, caption: null, width: 800, height: 450 },
      },
    ]);
    expect(issues[0]?.code).toBe("invalid_node");
  });

  it("keeps an image's display size only inside the allowed range, and not at full width", () => {
    const sized = (size: unknown) =>
      sanitizeDoc(doc({ type: "image", attrs: { assetId: ASSET, alt: "a", size } })).doc.content[0]?.attrs?.size;
    expect(sized(60)).toBe(60);
    expect(sized(25)).toBe(25);
    expect(sized(100)).toBeUndefined();
    expect(sized(10)).toBeUndefined();
    expect(sized(60.5)).toBeUndefined();
    expect(sized("60")).toBeUndefined();
  });

  it("keeps left and right alignment, and stores nothing for centred", () => {
    const aligned = (align: unknown) =>
      sanitizeDoc(doc({ type: "image", attrs: { assetId: ASSET, alt: "a", align } })).doc.content[0]?.attrs?.align;
    expect(aligned("left")).toBe("left");
    expect(aligned("right")).toBe("right");
    expect(aligned("center")).toBeUndefined();
    expect(aligned("float")).toBeUndefined();
  });

  it("keeps valid embeds as provider + id only", () => {
    const { doc: out } = sanitizeDoc(
      doc(
        { type: "embed", attrs: { provider: "youtube", id: "dQw4w9WgXcQ", html: "<iframe>" } },
        { type: "embed", attrs: { provider: "youtube", id: "not an id" } },
        { type: "embed", attrs: { provider: "vimeo", id: "123" } },
      ),
    );
    expect(out.content).toEqual([{ type: "embed", attrs: { provider: "youtube", id: "dQw4w9WgXcQ" } }]);
  });

  it("defaults unknown callout variants to info and removes empty containers", () => {
    const { doc: out } = sanitizeDoc(
      doc(
        { type: "callout", attrs: { variant: "danger" }, content: [p(text("Heads up"))] },
        { type: "blockquote", content: [{ type: "nope" }] },
      ),
    );
    expect(out.content).toEqual([
      { type: "callout", attrs: { variant: "info" }, content: [p(text("Heads up")) as DocNode] },
    ]);
  });

  it("cleans table cell spans", () => {
    const { doc: out } = sanitizeDoc(
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [{ type: "tableHeader", attrs: { colspan: 500, colwidth: [100] }, content: [p(text("A"))] }],
          },
        ],
      }),
    );
    expect(out.content[0]?.content?.[0]?.content?.[0]?.attrs).toEqual({ colspan: 1, rowspan: 1 });
  });

  it("stops at the depth limit", () => {
    let node: unknown = p(text("deep"));
    for (let i = 0; i < 30; i++) node = { type: "blockquote", content: [node] };
    const { issues } = sanitizeDoc(doc(node));
    expect(issues.some((issue) => issue.code === "too_deep")).toBe(true);
  });
});
