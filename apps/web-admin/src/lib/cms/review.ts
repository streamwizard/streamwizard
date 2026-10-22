// Where a draft stands with the other admins. Advisory: it never blocks
// publishing, it just says out loud whether anyone has looked at this yet.
// Every admin can set any of these; there is no author/editor split.

export const REVIEW_STATES = ["none", "requested", "changes", "approved"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_LABELS: Record<ReviewState, string> = {
  none: "Not in review",
  requested: "Waiting for a read",
  changes: "Changes asked for",
  approved: "Looks good",
};

/** What the badge should look like, in the variants @repo/ui's Badge takes. */
export const REVIEW_BADGE: Record<ReviewState, "outline" | "secondary" | "default" | "destructive"> = {
  none: "outline",
  requested: "secondary",
  changes: "destructive",
  approved: "default",
};

/** Worth filtering the content list by; "none" is every post nobody has asked about. */
export const REVIEW_FILTER_STATES = REVIEW_STATES.filter((state) => state !== "none") as Exclude<
  ReviewState,
  "none"
>[];

export function asReviewState(value: string | null | undefined): ReviewState {
  return REVIEW_STATES.includes(value as ReviewState) ? (value as ReviewState) : "none";
}

/** The states worth offering next, so the menu isn't a list with the current one in it. */
export function nextReviewStates(current: ReviewState): ReviewState[] {
  return REVIEW_STATES.filter((state) => state !== current);
}

export interface CommentCounts {
  /** Open threads, replies not counted: that is what a badge should say. */
  open: number;
  resolved: number;
}

export function countComments(
  comments: readonly { parentId: string | null; resolvedAt: string | null }[],
): CommentCounts {
  let open = 0;
  let resolved = 0;
  for (const comment of comments) {
    if (comment.parentId) continue;
    if (comment.resolvedAt) resolved++;
    else open++;
  }
  return { open, resolved };
}
