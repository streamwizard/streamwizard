import { describe, expect, it } from "bun:test";
import { pageOutline, sanitizeDoc } from "@repo/cms";
import { CONTENT_TEMPLATES, findTemplate, templatesFor } from "./templates";

describe("CONTENT_TEMPLATES", () => {
  it("every template is content the renderer can draw", () => {
    // The test that earns its keep: a template shipping an unknown node would
    // arrive in the editor and be thrown away on the first save.
    for (const template of CONTENT_TEMPLATES) {
      const content = template.build();
      expect(sanitizeDoc(content.body).issues).toEqual([]);
      for (const section of content.sections) expect(sanitizeDoc(section.body).issues).toEqual([]);
    }
  });

  it("every template's headings get their own anchor", () => {
    for (const template of CONTENT_TEMPLATES) {
      const content = template.build();
      const outline = pageOutline(content.body, content.sections);
      const anchors = outline.toc.map((entry) => entry.anchor);
      expect(new Set(anchors).size).toBe(anchors.length);
      expect(anchors.every(Boolean)).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = CONTENT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("templatesFor", () => {
  it("offers the guide skeleton only to guides", () => {
    expect(templatesFor("guide").map((template) => template.id)).toContain("how-to");
    expect(templatesFor("blog").map((template) => template.id)).not.toContain("how-to");
  });

  it("offers blank to both", () => {
    expect(templatesFor("blog").map((template) => template.id)).toContain("blank");
    expect(templatesFor("guide").map((template) => template.id)).toContain("blank");
  });

  it("only a guide template has sections", () => {
    for (const template of templatesFor("blog")) expect(template.build().sections).toEqual([]);
  });
});

describe("findTemplate", () => {
  it("refuses a template that doesn't fit the kind of post", () => {
    expect(findTemplate("blog", "how-to")).toBeNull();
    expect(findTemplate("guide", "how-to")?.id).toBe("how-to");
  });

  it("treats an unknown or missing id as no template", () => {
    expect(findTemplate("blog", "../../etc/passwd")).toBeNull();
    expect(findTemplate("blog", undefined)).toBeNull();
  });
});
