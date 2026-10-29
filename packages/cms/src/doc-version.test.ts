import { describe, expect, it } from "bun:test";
import { sanitizeDoc, type Doc } from "./doc";
import { DOC_VERSION, docVersion, migrateDoc, stampDoc } from "./doc-version";

const doc = (...content: Doc["content"]): Doc => ({ type: "doc", content });
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("docVersion", () => {
  it("reads an unmarked document as the first version", () => {
    expect(docVersion(doc(p("hello")))).toBe(1);
    expect(docVersion({ type: "doc", attrs: {}, content: [] })).toBe(1);
  });

  it("reads the stored version", () => {
    expect(docVersion({ type: "doc", attrs: { v: 7 }, content: [] })).toBe(7);
  });

  it("ignores a version that isn't a whole number", () => {
    expect(docVersion({ type: "doc", attrs: { v: "2" }, content: [] })).toBe(1);
    expect(docVersion({ type: "doc", attrs: { v: 1.5 }, content: [] })).toBe(1);
    expect(docVersion({ type: "doc", attrs: { v: 0 }, content: [] })).toBe(1);
  });

  it("survives junk", () => {
    expect(docVersion(null)).toBe(1);
    expect(docVersion("doc")).toBe(1);
    expect(docVersion([])).toBe(1);
  });
});

describe("stampDoc", () => {
  it("marks the current version and keeps the content", () => {
    const stamped = stampDoc(doc(p("hello")));
    expect(stamped.attrs).toEqual({ v: DOC_VERSION });
    expect(stamped.content).toEqual([p("hello")]);
  });
});

describe("sanitizeDoc", () => {
  it("stamps everything it writes", () => {
    expect(sanitizeDoc(doc(p("hello"))).doc.attrs).toEqual({ v: DOC_VERSION });
    expect(sanitizeDoc("not a document").doc.attrs).toEqual({ v: DOC_VERSION });
  });

  it("round-trips through a read at the current version", () => {
    const stored = sanitizeDoc(doc(p("hello"))).doc;
    const read = migrateDoc(stored);
    expect(read.from).toBe(DOC_VERSION);
    expect(read.future).toBe(false);
    expect(read.doc.content).toEqual(stored.content);
  });
});

describe("migrateDoc", () => {
  it("hands back a document the editor can own, without the stamp", () => {
    const read = migrateDoc(stampDoc(doc(p("hello"))));
    expect(read.doc.attrs).toBeUndefined();
    expect(read.doc).toEqual(doc(p("hello")));
  });

  it("reads content written before versions existed", () => {
    const read = migrateDoc(doc(p("old")));
    expect(read.from).toBe(1);
    expect(read.future).toBe(false);
    expect(read.doc.content).toEqual([p("old")]);
  });

  it("leaves a newer version alone and says so", () => {
    const read = migrateDoc({ type: "doc", attrs: { v: DOC_VERSION + 1 }, content: [p("from the future")] });
    expect(read.future).toBe(true);
    expect(read.from).toBe(DOC_VERSION + 1);
    expect(read.doc.content).toEqual([p("from the future")]);
  });

  it("turns anything that isn't a document into an empty one", () => {
    expect(migrateDoc(null).doc).toEqual({ type: "doc", content: [] });
    expect(migrateDoc({ type: "paragraph" }).doc).toEqual({ type: "doc", content: [] });
    expect(migrateDoc({ type: "doc", content: "nope" }).doc).toEqual({ type: "doc", content: [] });
  });
});
