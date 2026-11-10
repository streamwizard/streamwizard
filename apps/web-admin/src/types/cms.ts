// Shapes the Content section's server actions hand to its components.

/** An account an author can be linked to, from the author editor's search. */
export interface CmsAccountOption {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** An admin's note on a draft, as the comments sheet shows it. */
export interface CmsCommentView {
  id: string;
  body: string;
  anchor: string | null;
  sectionId: string | null;
  parentId: string | null;
  authorId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** An active preview link for a draft. */
export interface CmsPreviewLink {
  id: string;
  expiresAt: string;
  createdAt: string;
}
