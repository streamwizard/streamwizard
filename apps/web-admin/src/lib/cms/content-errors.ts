import type { PublicFootprint } from "@repo/cms";

// Turns what the CMS database functions raise into something an admin can
// act on, and their footprints into @repo/cms's shape. Pure.

export type ContentFailure =
  | { kind: "conflict" }
  | { kind: "not_found" }
  | { kind: "message"; message: string }
  | { kind: "unknown" };

interface DbError {
  code?: string;
  message?: string;
  details?: string;
}

const INVALID_MESSAGES: [RegExp, string][] = [
  [/^at least one author/, "Add at least one author."],
  [/^a title is required/, "Give it a title first."],
  [/^only guides have sections/, "Only guides have sections."],
  [/belongs to another post/, "A section got mixed up with another post. Reload the page."],
];

export function classifyContentError(error: unknown): ContentFailure {
  if (!error || typeof error !== "object") return { kind: "unknown" };
  const { code, message = "", details = "" } = error as DbError;
  if (message === "cms_conflict") return { kind: "conflict" };
  if (message === "cms_not_found") return { kind: "not_found" };
  if (message.startsWith("cms_invalid: ")) {
    const reason = message.slice("cms_invalid: ".length);
    const known = INVALID_MESSAGES.find(([pattern]) => pattern.test(reason));
    return { kind: "message", message: known?.[1] ?? `Can't do that: ${reason}.` };
  }
  if (code === "23505" && `${message} ${details}`.includes("slug")) {
    return { kind: "message", message: "Another post of this type already uses that slug. Pick a different one." };
  }
  if (code === "23514" && `${message} ${details}`.includes("slug")) {
    return { kind: "message", message: "Slugs use lowercase letters, numbers and single dashes, like set-up-obs." };
  }
  if (code === "23514" && `${message} ${details}`.includes("canonical")) {
    return { kind: "message", message: "The canonical URL has to start with https://." };
  }
  return { kind: "unknown" };
}

interface DbFootprint {
  id: string;
  type: "blog" | "guide";
  category_ids: string[] | null;
  tag_ids: string[] | null;
  author_ids: string[] | null;
}

/** A footprint as the database functions return it, or null. */
export function toFootprint(value: unknown): PublicFootprint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as DbFootprint;
  if (typeof raw.id !== "string" || (raw.type !== "blog" && raw.type !== "guide")) return null;
  return {
    id: raw.id,
    type: raw.type,
    categoryIds: raw.category_ids ?? [],
    tagIds: raw.tag_ids ?? [],
    authorIds: raw.author_ids ?? [],
  };
}
