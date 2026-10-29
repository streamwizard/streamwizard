import type { Doc, DocNode } from "@repo/cms";
import { emptyDoc, type ContentType } from "./draft";

// A starting shape for a new post, so nobody faces an empty page. Templates
// are plain content: placeholder headings, prompts in callouts, empty
// sections. They go through deriveDraft like anything typed by hand, so they
// are cleaned, counted and anchored on the way in.

export interface TemplateContent {
  summary: string;
  body: Doc;
  /** Guide sections, or an empty list for a blog post. */
  sections: { title: string; body: Doc }[];
  prerequisites: string[];
}

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  /** Which kind of post it starts; "both" shows up for either. */
  type: ContentType | "both";
  build: () => TemplateContent;
}

const doc = (...content: DocNode[]): Doc => ({ type: "doc", content });
const p = (text: string): DocNode =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
const h = (level: 2 | 3, text: string): DocNode => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const callout = (variant: "info" | "tip" | "warning", text: string): DocNode => ({
  type: "callout",
  attrs: { variant },
  content: [p(text)],
});
const bullets = (...items: string[]): DocNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});

export const CONTENT_TEMPLATES: readonly ContentTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from nothing.",
    type: "both",
    build: () => ({ summary: "", body: emptyDoc(), sections: [], prerequisites: [] }),
  },
  {
    id: "how-to",
    name: "How-to guide",
    description: "What the reader needs first, then one section per step.",
    type: "guide",
    build: () => ({
      summary: "",
      body: doc(
        p("What will the reader have working by the end? Two sentences, no build-up."),
        callout("info", "Delete this note once the intro says what the guide does."),
      ),
      sections: [
        { title: "Step 1", body: doc(p("What to do, then what they should see."), p("")) },
        { title: "Step 2", body: doc(p("")) },
        { title: "Step 3", body: doc(p("")) },
        {
          title: "If it doesn't work",
          body: doc(p("The two or three things that go wrong most, and what to do about each.")),
        },
      ],
      prerequisites: ["A StreamWizard account", "OBS installed"],
    }),
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "What changed, why, and what to do about it.",
    type: "blog",
    build: () => ({
      summary: "",
      body: doc(
        h(2, "What changed"),
        p(""),
        h(2, "Why"),
        p(""),
        h(2, "What you need to do"),
        bullets("Nothing: it's already on.", "Replace this list with the real steps, or cut it."),
      ),
      sections: [],
      prerequisites: [],
    }),
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    description: "One heading per symptom, with the fix under it.",
    type: "both",
    build: () => ({
      summary: "",
      body: doc(
        p("Which problem this page solves, in the words someone would search for."),
        h(2, "The first symptom"),
        p("What it looks like."),
        h(3, "Fix"),
        p(""),
        h(2, "The second symptom"),
        p("What it looks like."),
        h(3, "Fix"),
        p(""),
        callout("warning", "Say plainly when something can't be fixed from the dashboard."),
      ),
      sections: [],
      prerequisites: [],
    }),
  },
];

export function templatesFor(type: ContentType): ContentTemplate[] {
  return CONTENT_TEMPLATES.filter((template) => template.type === "both" || template.type === type);
}

/** The template by id, as long as it fits the kind of post being made. */
export function findTemplate(type: ContentType, id: string | undefined): ContentTemplate | null {
  if (!id) return null;
  return templatesFor(type).find((template) => template.id === id) ?? null;
}
