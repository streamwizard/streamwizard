// The publishing state machine. The database functions enforce the same
// rules; this is the copy the editor and the actions use to decide which
// buttons to show and to reject a bad request before it reaches the database.

export const CONTENT_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_ACTIONS = [
  "publish",
  "schedule",
  "unschedule",
  "update",
  "unpublish",
  "archive",
  "unarchive",
] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

// Which actions each status allows, and where each one leads.
const TRANSITIONS: Record<ContentStatus, Partial<Record<ContentAction, ContentStatus>>> = {
  draft: { publish: "published", schedule: "scheduled" },
  // "schedule" again = pick a new time.
  scheduled: { publish: "published", schedule: "scheduled", unschedule: "draft" },
  published: { update: "published", unpublish: "draft", archive: "archived" },
  archived: { publish: "published", unarchive: "draft" },
};

// A schedule has to be far enough ahead that the scheduler (30 s tick) can't
// miss the window, and close enough that it isn't a typo for another year.
export const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;
export const MAX_SCHEDULE_LEAD_MS = 366 * 24 * 60 * 60 * 1000;

export interface TransitionInput {
  now: Date;
  // Required for "schedule".
  publishAt?: Date | null;
}

export type TransitionResult =
  | {
      ok: true;
      status: ContentStatus;
      // Whether the post is on the public site before and after. Decides
      // which caches to refresh, and whether stale copies may still be served.
      wasPublic: boolean;
      isPublic: boolean;
    }
  | { ok: false; error: string };

export function isPublicStatus(status: ContentStatus): boolean {
  return status === "published";
}

export function allowedActions(status: ContentStatus): ContentAction[] {
  return Object.keys(TRANSITIONS[status]) as ContentAction[];
}

export function transition(status: ContentStatus, action: ContentAction, input: TransitionInput): TransitionResult {
  const next = TRANSITIONS[status][action];
  if (!next) return { ok: false, error: `A ${status} post can't be ${pastTense(action)}.` };

  if (action === "schedule") {
    const publishAt = input.publishAt;
    if (!publishAt || Number.isNaN(publishAt.getTime()))
      return { ok: false, error: "Pick a date and time to publish." };
    const lead = publishAt.getTime() - input.now.getTime();
    if (lead < MIN_SCHEDULE_LEAD_MS)
      return { ok: false, error: "Pick a time at least 2 minutes from now, or publish it right away." };
    if (lead > MAX_SCHEDULE_LEAD_MS) return { ok: false, error: "That's more than a year away. Check the date." };
  }

  return { ok: true, status: next, wasPublic: isPublicStatus(status), isPublic: isPublicStatus(next) };
}

function pastTense(action: ContentAction): string {
  switch (action) {
    case "publish":
      return "published";
    case "schedule":
      return "scheduled";
    case "unschedule":
      return "unscheduled";
    case "update":
      return "updated";
    case "unpublish":
      return "unpublished";
    case "archive":
      return "archived";
    case "unarchive":
      return "unarchived";
  }
}
