// Turns what the CMS database functions raise into something an admin can
// act on. Pure.

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
  [/^the publish time has to be in the future/, "Pick a time in the future."],
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

/** schedule_error as the scheduler stored it (a raw database message), for the editor's banner. */
export function describeScheduleError(raw: string): string {
  const failure = classifyContentError({ message: raw });
  if (failure.kind === "message") return failure.message;
  if (failure.kind === "conflict") return "Someone was saving it at that moment. Schedule it again.";
  return raw;
}
