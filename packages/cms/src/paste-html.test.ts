import { describe, expect, it } from "bun:test";
import { cleanPastedHtml, detectSource } from "./paste-html";

// Shortened captures of what each editor actually puts on the clipboard.
const GOOGLE_DOCS = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-9f3a">
<h1 dir="ltr" style="line-height:1.38;margin-top:20pt;"><span style="font-size:20pt;font-weight:400;">Set up OBS</span></h1>
<p dir="ltr" style="line-height:1.38;"><span style="font-size:11pt;">Open </span><span style="font-size:11pt;font-weight:700;">Settings</span><span style="font-size:11pt;"> then </span><span style="font-size:11pt;font-style:italic;">Output</span><span style="font-size:11pt;">.</span></p>
<h2 dir="ltr"><span style="font-weight:400;">Encoder</span></h2>
<ul style="margin-top:0;"><li dir="ltr"><p dir="ltr"><span>x264</span></p></li></ul>
<p dir="ltr"><a href="https://streamwizard.org/pricing" style="text-decoration:none;"><span style="color:#1155cc;">Pricing</span></a></p>
<img src="https://lh7-us.googleusercontent.com/abc123" width="624" height="351" />
</b>`;

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0cm;} --></style></head>
<body lang=EN-GB style='word-wrap:break-word'>
<p class=MsoTitle>Stream setup</p>
<p class=MsoHeading1 style='mso-outline-level:1'>Before you start</p>
<p class=MsoNormal><b style='mso-bidi-font-weight:normal'>Bold<o:p></o:p></b> and plain.</p>
<p class=MsoNormal><span style='mso-spacerun:yes'>&nbsp;</span></p>
<table class=MsoTableGrid border=1 cellspacing=0><tr><td width=200 valign=top><p class=MsoNormal>Cell</p></td></tr></table>
<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->
</body></html>`;

const ARTICLE = `<article class="post"><h1>Why latency matters</h1><p>Some <b>bold</b> and <i>italic</i>.</p>
<h4>Deep heading</h4><div class="ad"><img src="https://cdn.example.com/banner.png" alt="ad"></div>
<pre><code class="language-ts">const x = &lt;T,&gt;(v: T) =&gt; v;</code></pre></article>`;

describe("detectSource", () => {
  it("knows where a paste came from", () => {
    expect(detectSource(GOOGLE_DOCS)).toBe("google-docs");
    expect(detectSource(WORD)).toBe("word");
    expect(detectSource(ARTICLE)).toBe("html");
    expect(detectSource("just some text")).toBe("plain");
  });
});

describe("cleanPastedHtml", () => {
  it("leaves plain text alone", () => {
    const { html, report } = cleanPastedHtml("a < b and 3 > 2");
    expect(html).toBe("a < b and 3 > 2");
    expect(report).toEqual({ source: "plain", images: [], headingsRemapped: 0, stripped: 0 });
  });

  describe("Google Docs", () => {
    const { html, report } = cleanPastedHtml(GOOGLE_DOCS);

    it("drops the wrapper that would make everything bold", () => {
      expect(html).not.toContain("docs-internal-guid");
      expect(html).not.toContain("font-weight:normal");
    });

    it("keeps the formatting the writer applied", () => {
      expect(html).toContain("<strong>Settings</strong>");
      expect(html).toContain("<em>Output</em>");
    });

    it("moves the H1 into the body's range", () => {
      expect(html).toContain("<h2>Set up OBS</h2>");
      expect(html).toContain("<h3>Encoder</h3>");
      expect(report.headingsRemapped).toBe(2);
    });

    it("keeps links and lists", () => {
      expect(html).toContain('<a href="https://streamwizard.org/pricing">Pricing</a>');
      expect(html).toContain("<li>");
    });

    it("takes the images out and says which", () => {
      expect(report.images).toEqual(["https://lh7-us.googleusercontent.com/abc123"]);
      expect(html).not.toContain("<img");
    });

    it("leaves nothing to style the page with", () => {
      expect(html).not.toMatch(/style\s*=/i);
      expect(html).not.toContain("<span");
      expect(html).not.toMatch(/<h[156]\b/);
    });
  });

  describe("Word", () => {
    const { html, report } = cleanPastedHtml(WORD);

    it("turns styled paragraphs into headings", () => {
      // Word's Title and its Heading 1 both sit above the body's levels, so
      // both land on H2; the page title itself lives in its own field.
      expect(html).toContain("<h2>Stream setup</h2>");
      expect(html).toContain("<h2>Before you start</h2>");
      expect(report.headingsRemapped).toBe(2);
    });

    it("keeps real bold rather than reading Word's own marker as normal", () => {
      expect(html).toContain("<strong>Bold</strong>");
    });

    it("throws away the office markup", () => {
      expect(html).not.toMatch(/mso-|Mso[A-Z]|urn:schemas-microsoft-com/);
      expect(html).not.toContain("<o:p>");
      expect(html).not.toContain("<style");
      expect(html).not.toContain("<!--");
    });

    it("drops the padding paragraphs", () => {
      expect(html).not.toMatch(/<p>\s*(&nbsp;)?\s*<\/p>/);
    });

    it("keeps the table and its spans", () => {
      expect(html).toContain("<table>");
      expect(html).toContain("<td>");
    });
  });

  describe("a web page", () => {
    const { html, report } = cleanPastedHtml(ARTICLE);

    it("shifts the headings down and pulls the deep one up", () => {
      expect(html).toContain("<h2>Why latency matters</h2>");
      // h4 + the shift would be h5, which the page has no room for.
      expect(html).toContain("<h4>Deep heading</h4>");
    });

    it("keeps bold and italic as the schema spells them", () => {
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });

    it("reports the image it removed", () => {
      expect(report.images).toEqual(["https://cdn.example.com/banner.png"]);
    });

    it("leaves code exactly as it was", () => {
      expect(html).toContain('<pre><code class="language-ts">const x = &lt;T,&gt;(v: T) =&gt; v;</code></pre>');
    });
  });

  it("survives a fragment with no closing tags", () => {
    const { html } = cleanPastedHtml("<p>one<p>two");
    expect(html).toContain("one");
    expect(html).toContain("two");
  });
});
