import { checkAccessibility, extractText, isValidSlug, type Doc } from "@repo/cms";
import { canonicalProblem, type ContentDraft, type ContentType } from "./draft";
import { toneFindings } from "./tone";

// What stands between a draft and the Publish button. Errors block
// publishing; warnings are worth fixing but don't. Pure: the editor shows the
// list live, the publish action checks it again on the server.

export interface ReadinessItem {
  severity: "error" | "warning";
  message: string;
  /** The guide section it is in, when it is in one. */
  section?: number;
}

export interface ReadinessContext {
  /** Alt text of the chosen cover (null: no alt, undefined: unknown here). */
  coverAlt?: { alt: string; decorative: boolean } | null;
}

const MIN_EXCERPT = 50;

export function publishReadiness(
  type: ContentType,
  draft: ContentDraft,
  context: ReadinessContext = {},
): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const error = (message: string, section?: number) => items.push({ severity: "error", message, section });
  const warning = (message: string) => items.push({ severity: "warning", message });

  if (!draft.title.trim()) error("Add a title.");
  if (!isValidSlug(draft.slug.trim())) error("The slug needs lowercase letters, numbers and single dashes.");
  else if (/^untitled-[0-9a-f]{8}$/.test(draft.slug.trim())) error("Give it a real slug: it becomes the page's URL.");
  if (draft.authorIds.length === 0) error("Add at least one author.");
  if (!draft.excerpt.trim()) error("Write an excerpt: it shows on cards, in search results and in link previews.");
  else if (draft.excerpt.trim().length < MIN_EXCERPT)
    warning("The excerpt is very short. Aim for one or two full sentences.");
  if (!draft.coverAssetId) error("Pick a cover image.");
  else if (context.coverAlt === null) error("The cover image needs alt text.");
  else if (context.coverAlt && !context.coverAlt.decorative && !context.coverAlt.alt.trim())
    error("The cover image needs alt text.");
  const canonical = canonicalProblem(draft.canonicalUrl);
  if (canonical) error(canonical);

  if (!draft.summary.trim()) warning("Add a summary: a short, direct answer at the top. AI assistants quote it.");
  if (draft.categoryIds.length === 0) warning("Pick a category so readers can find related posts.");

  if (type === "guide") {
    if (draft.sections.length === 0) warning("Guides read best in sections. Add at least one.");
    draft.sections.forEach((section, index) => {
      if (!section.title.trim()) error(`Section ${index + 1} needs a title.`, index);
    });
    if (!draft.difficulty) warning("Set a difficulty so readers know what they're in for.");
  }

  const bodies: Doc[] = type === "guide" ? draft.sections.map((section) => section.body) : [];
  for (const issue of checkAccessibility(draft.body, bodies)) {
    items.push({ severity: issue.severity, message: issue.message, section: issue.section ?? undefined });
  }

  const texts = [
    draft.title,
    draft.summary,
    draft.excerpt,
    draft.seoTitle,
    draft.seoDescription,
    extractText(draft.body),
    ...(type === "guide" ? draft.sections.flatMap((section) => [section.title, extractText(section.body)]) : []),
  ];
  for (const finding of toneFindings(texts)) warning(finding.message);
  return items;
}

export function canPublish(items: ReadinessItem[]): boolean {
  return !items.some((item) => item.severity === "error");
}
