import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { pageOutline, type Doc } from "@repo/cms";
import { CmsDocument } from "./cms-document";

const ASSET = "0b9f7c1e-6a3d-4c55-9b0e-2f1a8d7e6c4b";

function render(
  doc: Doc,
  resolve: (
    attrs: Record<string, unknown>,
  ) => { src: string; width: number | null; height: number | null } | null = () => null,
) {
  const outline = pageOutline(doc);
  return renderToStaticMarkup(
    <CmsDocument doc={doc} anchors={outline.bodyAnchors} resolveImage={resolve} parentHost="streamwizard.org" />,
  );
}

const text = (value: string, marks?: Doc["content"][number]["marks"]) => ({ type: "text", text: value, marks });

describe("CmsDocument", () => {
  it("gives headings the anchors pageOutline hands out", () => {
    const html = render({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("Setup")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Setup")] },
      ],
    });
    expect(html).toContain('<h2 id="setup"');
    expect(html).toContain('<h3 id="setup-2"');
  });

  it("renders marks with the link outermost and external links marked", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            text("docs", [{ type: "bold" }, { type: "link", attrs: { href: "https://docs.streamwizard.org" } }]),
          ],
        },
      ],
    });
    expect(html).toBe(
      '<p><a href="https://docs.streamwizard.org/" rel="noopener noreferrer"><strong>docs</strong></a></p>',
    );
  });

  it("never renders an unsafe link, even if one got stored", () => {
    const html = render({
      type: "doc",
      content: [
        { type: "paragraph", content: [text("click", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])] },
      ],
    });
    expect(html).toBe("<p>click</p>");
  });

  it("drops nodes it doesn't know", () => {
    expect(
      render({
        type: "doc",
        content: [
          { type: "iframe", attrs: { src: "https://evil.example" } },
          { type: "paragraph", content: [text("ok")] },
        ],
      }),
    ).toBe("<p>ok</p>");
  });

  it("builds embed iframes from provider and id only", () => {
    const html = render({
      type: "doc",
      content: [{ type: "embed", attrs: { provider: "twitch_clip", id: "Clip-1" } }],
    });
    expect(html).toContain(
      'src="https://clips.twitch.tv/embed?clip=Clip-1&amp;parent=streamwizard.org&amp;autoplay=false"',
    );
    expect(html).toContain('title="Twitch clip"');
  });

  it("shows images only when they resolve, with empty alt when decorative", () => {
    const doc: Doc = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: ASSET, alt: "OBS window", decorative: true } }],
    };
    expect(render(doc)).toBe("");
    const html = render(doc, () => ({ src: "https://cdn.streamwizard.org/cms/x.png", width: null, height: null }));
    expect(html).toContain('alt=""');
    expect(html).not.toContain("OBS window");
  });

  it("marks table headers as column headers", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [text("Setting")] }] }],
            },
          ],
        },
      ],
    });
    expect(html).toContain('<th scope="col"><p>Setting</p></th>');
  });
});
